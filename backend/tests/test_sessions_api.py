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
from models.catalog_sizes import CatalogSize
from models.order_events import OrderEvent
from models.orders import Order, OrderStatus
from models.sessions import SessionModel
from models.users import Role, User
from routers import sessions as sessions_router


def set_current_user(role: Role, user_id: int = 1, username: str = "admin"):
    def override_current_user_with_role():
        return SimpleNamespace(id=user_id, username=username, role=role)

    app.dependency_overrides[sessions_router.get_current_user] = override_current_user_with_role


@pytest.fixture()
def api_fixture(tmp_path):
    db_path = tmp_path / "sessions_test.sqlite3"
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
    size = CatalogSize(code="M", sort_order=1, is_active=True)
    seed_db.add_all([color, size])
    seed_db.flush()

    model = CatalogModel(name="Hoodie", color_id=color.id, is_active=True)
    seed_db.add(model)
    seed_db.flush()

    model_size = CatalogModelSize(model_id=model.id, size_id=size.id, stock_qty=4, is_active=True)
    seed_db.add(model_size)
    seed_db.flush()

    active_session = SessionModel(is_active=True, started_by_user_id=admin.id, has_nanesenie=False)
    seed_db.add(active_session)
    seed_db.flush()

    order = Order(
        status=OrderStatus.CONFIRMED.value,
        model_id=model.id,
        size_id=size.id,
        session_id=active_session.id,
    )
    seed_db.add(order)
    seed_db.flush()

    event = OrderEvent(order_id=order.id, event_type="order_created", user_id=admin.id)
    seed_db.add(event)
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

    ids = {
        "admin_id": admin_id,
        "reception_id": reception_id,
        "model_id": model.id,
        "size_id": size.id,
        "active_session_id": active_session.id,
    }

    seed_db.close()

    yield client, testing_session_local, ids

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_restart_session_admin_only(api_fixture):
    client, _session_local, ids = api_fixture

    set_current_user(Role.RECEPTION, user_id=ids["reception_id"], username="reception")
    response = client.post("/sessions/restart", json={"has_nanesenie": True, "restore_stock": True})

    assert response.status_code == 403


def test_restart_session_cancels_orders_and_restock(api_fixture):
    client, session_local, ids = api_fixture

    response = client.post("/sessions/restart", json={"has_nanesenie": True, "restore_stock": True})

    assert response.status_code == 200
    payload = response.json()
    assert payload["canceled_orders"] == 1
    assert payload["restocked_items"] == 1
    assert payload["session"]["is_active"] is True
    assert payload["session"]["has_nanesenie"] is True

    db = session_local()
    # Заказ остаётся в БД, но переводится в CANCELED
    orders = db.query(Order).all()
    assert len(orders) == 1
    assert orders[0].status == "canceled"
    assert orders[0].cancel_reason == "Смена перезапущена"
    # События сохраняются для статистики
    assert db.query(OrderEvent).count() == 1
    model_size = (
        db.query(CatalogModelSize)
        .filter(
            CatalogModelSize.model_id == ids["model_id"],
            CatalogModelSize.size_id == ids["size_id"],
        )
        .first()
    )
    assert model_size is not None
    assert model_size.stock_qty == 5
    active_sessions_count = db.query(SessionModel).filter(SessionModel.is_active == True).count()
    assert active_sessions_count == 1
    db.close()


def test_continue_session_reactivates_last_stopped(api_fixture):
    client, _session_local, ids = api_fixture

    stop_response = client.post("/sessions/stop")
    assert stop_response.status_code == 200

    continue_response = client.post("/sessions/continue")
    assert continue_response.status_code == 200

    body = continue_response.json()
    assert body["id"] == ids["active_session_id"]
    assert body["is_active"] is True


def test_start_session_without_body_uses_defaults(api_fixture):
    client, _session_local, _ids = api_fixture

    stop_response = client.post("/sessions/stop")
    assert stop_response.status_code == 200

    start_response = client.post("/sessions/start")
    assert start_response.status_code == 200
    body = start_response.json()
    assert body["is_active"] is True
    assert body["has_nanesenie"] is True
