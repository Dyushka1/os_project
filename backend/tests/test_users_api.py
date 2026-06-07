from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models.users import Role, User
from routers import users as users_router


def set_current_user(role: Role, user_id: int = 1, username: str = "admin"):
    def override_current_user_with_role():
        return SimpleNamespace(id=user_id, username=username, role=role)

    app.dependency_overrides[users_router.get_current_user] = override_current_user_with_role


@pytest.fixture()
def api_fixture(tmp_path):
    db_path = tmp_path / "users_test.sqlite3"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)

    seed_db = testing_session_local()
    admin = User(username="admin", password_hash="x", role=Role.ADMIN)
    reception = User(username="reception", password_hash="x", role=Role.RECEPTION)
    seed_db.add_all([admin, reception])
    seed_db.commit()
    seed_db.refresh(admin)
    seed_db.refresh(reception)

    admin_id = admin.id
    reception_id = reception.id

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    set_current_user(Role.ADMIN, user_id=admin_id, username="admin")

    client = TestClient(app)

    ids = {
        "admin_id": admin_id,
        "reception_id": reception_id,
    }

    seed_db.close()

    yield client, testing_session_local, ids

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_list_users_admin_only(api_fixture):
    client, _session_local, _ids = api_fixture

    set_current_user(Role.RECEPTION, user_id=2, username="reception")
    forbidden_response = client.get("/users/")
    assert forbidden_response.status_code == 403

    set_current_user(Role.ADMIN, user_id=1, username="admin")
    ok_response = client.get("/users/")
    assert ok_response.status_code == 200
    assert len(ok_response.json()) >= 2


def test_update_user_changes_username_role_and_password(api_fixture):
    client, session_local, ids = api_fixture

    response = client.put(
        f"/users/{ids['reception_id']}",
        json={
            "username": "+79991112233",
            "role": "user",
            "password": "newpassword123",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "+79991112233"
    assert body["role"] == "user"

    db = session_local()
    updated_user = db.query(User).filter(User.id == ids["reception_id"]).first()
    assert updated_user is not None
    assert updated_user.password_hash != "x"
    db.close()


def test_update_user_rejects_invalid_phone_for_user_role(api_fixture):
    client, _session_local, ids = api_fixture

    response = client.put(
        f"/users/{ids['reception_id']}",
        json={
            "username": "abc",
            "role": "user",
        },
    )

    assert response.status_code == 422


def test_delete_user_forbids_deleting_self(api_fixture):
    client, _session_local, ids = api_fixture

    response = client.delete(f"/users/{ids['admin_id']}")

    assert response.status_code == 400
    assert "cannot delete self" in response.json()["detail"].lower()


def test_delete_user_success(api_fixture):
    client, session_local, ids = api_fixture

    response = client.delete(f"/users/{ids['reception_id']}")

    assert response.status_code == 200

    db = session_local()
    deleted_user = db.query(User).filter(User.id == ids["reception_id"]).first()
    assert deleted_user is None
    db.close()
