from types import SimpleNamespace
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models.orders import Order, OrderStatus
from models.sessions import SessionModel
from models.users import Role, User
from routers import stats as stats_router


def set_current_user(role: Role, user_id: int = 1, username: str = "admin"):
    def override_current_user_with_role():
        return SimpleNamespace(id=user_id, username=username, role=role)

    app.dependency_overrides[stats_router.get_current_user] = override_current_user_with_role


@pytest.fixture()
def api_fixture(tmp_path):
    db_path = tmp_path / "stats_test.sqlite3"
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
    seed_db.flush()

    active_session = SessionModel(
        is_active=True,
        started_at=datetime.now(timezone.utc),
        started_by_user_id=admin.id,
        has_nanesenie=True,
    )
    seed_db.add(active_session)
    seed_db.flush()

    orders = [
        Order(status=OrderStatus.CONFIRMED.value, session_id=active_session.id),
        Order(status=OrderStatus.PRINTED.value, session_id=active_session.id),
        Order(status=OrderStatus.NANESENIE_DONE.value, session_id=active_session.id),
        Order(status=OrderStatus.ISSUED.value, session_id=active_session.id),
    ]
    seed_db.add_all(orders)
    seed_db.commit()

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

    yield client, {"admin_id": admin_id, "reception_id": reception_id}

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_stats_summary_admin_only(api_fixture):
    client, ids = api_fixture

    set_current_user(Role.RECEPTION, user_id=ids["reception_id"], username="reception")
    forbidden_response = client.get("/stats/summary")
    assert forbidden_response.status_code == 403

    set_current_user(Role.ADMIN, user_id=ids["admin_id"], username="admin")
    ok_response = client.get("/stats/summary")
    assert ok_response.status_code == 200


def test_stats_summary_payload(api_fixture):
    client, _ids = api_fixture

    response = client.get("/stats/summary")
    assert response.status_code == 200

    payload = response.json()
    assert payload["total_orders"] == 4
    assert payload["completed_orders"] == 1
    assert payload["statuses"]["confirmed"] == 1
    assert payload["statuses"]["printed"] == 1
    assert payload["statuses"]["nanesenie_done"] == 1
    assert payload["statuses"]["issued"] == 1

    assert payload["queues"]["queue_print"] == 1
    assert payload["queues"]["queue_nanesenie"] == 1
    assert payload["queues"]["queue_issue"] == 1

    assert payload["active_session"] is not None
    assert payload["active_session"]["has_nanesenie"] is True
