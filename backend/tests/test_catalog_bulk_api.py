from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models.catalog_colors import CatalogColors
from models.catalog_model_sizes import CatalogModelSize
from models.catalog_models import CatalogModel
from models.catalog_prints import CatalogPrint
from models.catalog_sizes import CatalogSize
from models.users import Role, User
from routers import (
    catalog_color as catalog_color_router,
    catalog_model_sizes as catalog_model_sizes_router,
    catalog_models as catalog_models_router,
    catalog_prints as catalog_prints_router,
    catalog_sizes as catalog_sizes_router,
)


def set_current_user(role: Role, user_id: int = 1, username: str = "admin"):
    def override_current_user_with_role():
        return SimpleNamespace(id=user_id, username=username, role=role)

    app.dependency_overrides[catalog_color_router.get_current_user] = override_current_user_with_role
    app.dependency_overrides[catalog_sizes_router.get_current_user] = override_current_user_with_role
    app.dependency_overrides[catalog_models_router.get_current_user] = override_current_user_with_role
    app.dependency_overrides[catalog_prints_router.get_current_user] = override_current_user_with_role
    app.dependency_overrides[catalog_model_sizes_router.get_current_user] = override_current_user_with_role


@pytest.fixture()
def api_fixture(tmp_path):
    db_path = tmp_path / "catalog_bulk_test.sqlite3"
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

    color = CatalogColors(name="Black", hex_code="#000000", is_active=True)
    seed_db.add(color)
    seed_db.flush()

    model = CatalogModel(name="Hoodie", garment_type="hoodie", color_id=color.id, is_active=True)
    size = CatalogSize(code="M", sort_order=1, is_active=True)
    print_item = CatalogPrint(name="Logo", print_type="regular", stock_qty=100, is_active=True)
    seed_db.add_all([model, size, print_item])
    seed_db.flush()

    link = CatalogModelSize(model_id=model.id, size_id=size.id, stock_qty=3, is_active=True)
    seed_db.add(link)
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

    yield client, testing_session_local, {"admin_id": admin_id, "reception_id": reception_id}

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_catalog_bulk_delete_admin_only(api_fixture):
    client, _session_local, ids = api_fixture

    set_current_user(Role.RECEPTION, user_id=ids["reception_id"], username="reception")
    response = client.delete("/catalog/models/all")

    assert response.status_code == 403


def test_catalog_bulk_delete_in_safe_sequence(api_fixture):
    client, session_local, _ids = api_fixture

    response_links = client.delete("/catalog/model-sizes/all")
    response_models = client.delete("/catalog/models/all")
    response_sizes = client.delete("/catalog/sizes/all")
    response_colors = client.delete("/catalog/colors/all")
    response_prints = client.delete("/catalog/prints/all")

    assert response_links.status_code == 200
    assert response_models.status_code == 200
    assert response_sizes.status_code == 200
    assert response_colors.status_code == 200
    assert response_prints.status_code == 200

    db = session_local()
    assert db.query(CatalogModelSize).count() == 0
    assert db.query(CatalogModel).count() == 0
    assert db.query(CatalogSize).count() == 0
    assert db.query(CatalogColors).count() == 0
    assert db.query(CatalogPrint).count() == 0
    db.close()
