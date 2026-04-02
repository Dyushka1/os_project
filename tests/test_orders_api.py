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
from models.clients import Client
from models.order_events import OrderEvent
from models.orders import Order, OrderStatus
from models.sessions import SessionModel
from models.users import Role, User
from routers import orders as orders_router


def set_current_user_role(role: Role, user_id: int = 1, username: str = "worker"):
    def override_current_user_with_role():
        return SimpleNamespace(id=user_id, username=username, role=role)

    app.dependency_overrides[orders_router.get_current_user] = override_current_user_with_role


@pytest.fixture()
def api_fixture(tmp_path):
    db_path = tmp_path / "orders_test.sqlite3"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)

    seed_db = testing_session_local()
    admin = User(username="admin", password_hash="x", role=Role.ADMIN)
    seed_db.add(admin)
    seed_db.flush()

    active_session = SessionModel(is_active=True, started_by_user_id=admin.id)
    seed_db.add(active_session)

    existing_client = Client(name="Existing", phone="+79990001122", email="existing@test")
    seed_db.add(existing_client)

    color_1 = CatalogColors(name="Black", hex_code="#000000", is_active=True)
    color_2 = CatalogColors(name="White", hex_code="#ffffff", is_active=True)
    seed_db.add_all([color_1, color_2])
    seed_db.flush()

    model_1 = CatalogModel(name="Hoodie", color_id=color_1.id, is_active=True)
    model_2 = CatalogModel(name="TShirt", color_id=color_2.id, is_active=True)
    seed_db.add_all([model_1, model_2])

    size_1 = CatalogSize(code="M", sort_order=1, is_active=True)
    size_2 = CatalogSize(code="L", sort_order=2, is_active=True)
    seed_db.add_all([size_1, size_2])

    print_1 = CatalogPrint(name="Logo", print_type="regular", stock_qty=100, is_active=True)
    print_textual = CatalogPrint(name="TextLogo", print_type="text", stock_qty=100, is_active=True)
    print_inactive = CatalogPrint(name="OldLogo", print_type="regular", stock_qty=100, is_active=False)
    seed_db.add_all([print_1, print_textual, print_inactive])
    seed_db.flush()

    pair_1 = CatalogModelSize(model_id=model_1.id, size_id=size_1.id, stock_qty=5, is_active=True)
    pair_out_of_stock = CatalogModelSize(model_id=model_1.id, size_id=size_2.id, stock_qty=0, is_active=True)
    pair_2 = CatalogModelSize(model_id=model_2.id, size_id=size_1.id, stock_qty=2, is_active=True)
    seed_db.add_all([pair_1, pair_out_of_stock, pair_2])

    seed_db.commit()
    seed_db.refresh(active_session)
    seed_db.refresh(existing_client)
    seed_db.refresh(model_1)
    seed_db.refresh(model_2)
    seed_db.refresh(size_1)
    seed_db.refresh(size_2)
    seed_db.refresh(print_1)
    seed_db.refresh(print_textual)

    admin_id = admin.id
    session_id = active_session.id

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    def override_current_user():
        return SimpleNamespace(id=admin_id, username="admin", role=Role.ADMIN)

    def override_active_session_dep():
        return SimpleNamespace(id=session_id, is_active=True)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[orders_router.get_current_user] = override_current_user
    app.dependency_overrides[orders_router.require_active_session] = override_active_session_dep

    client = TestClient(app)

    ids = {
        "client_id": existing_client.id,
        "model_1_id": model_1.id,
        "model_2_id": model_2.id,
        "size_1_id": size_1.id,
        "size_2_id": size_2.id,
        "print_1_id": print_1.id,
        "print_text_id": print_textual.id,
    }

    seed_db.close()

    yield client, testing_session_local, ids

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_create_order_success_decrements_stock_and_logs_event(api_fixture):
    client, session_local, ids = api_fixture

    response = client.post(
        "/orders/",
        json={
            "client": {"name": "New Client", "phone": "+79991112233", "email": "new@test"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
            "print_id": ids["print_1_id"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "new"
    assert body["model_id"] == ids["model_1_id"]
    assert body["size_id"] == ids["size_1_id"]

    db = session_local()
    pair = (
        db.query(CatalogModelSize)
        .filter(
            CatalogModelSize.model_id == ids["model_1_id"],
            CatalogModelSize.size_id == ids["size_1_id"],
        )
        .first()
    )
    assert pair is not None
    assert pair.stock_qty == 4

    event = (
        db.query(OrderEvent)
        .filter(OrderEvent.order_id == body["id"], OrderEvent.event_type == "order_created")
        .first()
    )
    assert event is not None
    db.close()


def test_create_order_rejects_client_conflict(api_fixture):
    client, _session_local, ids = api_fixture

    response = client.post(
        "/orders/",
        json={
            "client_id": ids["client_id"],
            "client": {"name": "Conflict", "phone": "+70000000000"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
        },
    )

    assert response.status_code == 400
    assert "Provide either client_id or client data, not both" in response.json()["detail"]


def test_create_order_rejects_out_of_stock(api_fixture):
    client, _session_local, ids = api_fixture

    response = client.post(
        "/orders/",
        json={
            "client": {"name": "Stock Test", "phone": "+71111111111"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_2_id"],
        },
    )

    assert response.status_code == 400
    assert "out of stock" in response.json()["detail"].lower()


def test_update_order_catalog_rebalances_stock_and_logs_event(api_fixture):
    client, session_local, ids = api_fixture

    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Updater", "phone": "+72222222222"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
        },
    )
    assert create_response.status_code == 200
    order_id = create_response.json()["id"]

    update_response = client.put(
        f"/orders/{order_id}/catalog",
        json={"model_id": ids["model_2_id"], "size_id": ids["size_1_id"]},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["model_id"] == ids["model_2_id"]
    assert updated["size_id"] == ids["size_1_id"]

    db = session_local()
    old_pair = (
        db.query(CatalogModelSize)
        .filter(
            CatalogModelSize.model_id == ids["model_1_id"],
            CatalogModelSize.size_id == ids["size_1_id"],
        )
        .first()
    )
    new_pair = (
        db.query(CatalogModelSize)
        .filter(
            CatalogModelSize.model_id == ids["model_2_id"],
            CatalogModelSize.size_id == ids["size_1_id"],
        )
        .first()
    )
    assert old_pair is not None and new_pair is not None
    assert old_pair.stock_qty == 5
    assert new_pair.stock_qty == 1

    event = (
        db.query(OrderEvent)
        .filter(OrderEvent.order_id == order_id, OrderEvent.event_type == "order_catalog_updated")
        .first()
    )
    assert event is not None
    db.close()


def test_update_order_catalog_rejects_inactive_model(api_fixture):
    client, session_local, ids = api_fixture

    db = session_local()
    model_2 = db.query(CatalogModel).filter(CatalogModel.id == ids["model_2_id"]).first()
    assert model_2 is not None
    model_2.is_active = False
    db.commit()
    db.close()

    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Inactive Test", "phone": "+73333333333"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
        },
    )
    assert create_response.status_code == 200
    order_id = create_response.json()["id"]

    update_response = client.put(
        f"/orders/{order_id}/catalog",
        json={"model_id": ids["model_2_id"], "size_id": ids["size_1_id"]},
    )

    assert update_response.status_code == 400
    assert "inactive" in update_response.json()["detail"].lower()


def test_create_order_saves_promo_and_notify_fields(api_fixture):
    client, _session_local, ids = api_fixture

    response = client.post(
        "/orders/",
        json={
            "client": {"name": "Promo User", "phone": "+74444444444"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
            "print_id": ids["print_1_id"],
            "promo_code": "SPRING10",
            "notify_method": "telegram",
            "notify_contact": "@promo_user",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["promo_code"] == "SPRING10"
    assert body["notify_method"] == "telegram"
    assert body["notify_contact"] == "@promo_user"


def test_search_orders_finds_by_promo_code(api_fixture):
    client, _session_local, ids = api_fixture

    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Search Promo", "phone": "+75555555555"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
            "promo_code": "PROMO-777",
        },
    )
    assert create_response.status_code == 200
    created_order_id = create_response.json()["id"]

    search_response = client.get("/orders/search", params={"q": "PROMO-777"})
    assert search_response.status_code == 200

    rows = search_response.json()
    assert any(row["id"] == created_order_id for row in rows)


@pytest.mark.parametrize(
    "payload,expected_detail",
    [
        (
            {
                "print_id": "print_1_id",
                "print_x": 10,
            },
            "print_x and print_y must be provided together",
        ),
        (
            {
                "print_id": "print_1_id",
                "print_angle": 181,
            },
            "print_angle must be between -180 and 180",
        ),
        (
            {
                "print_id": "print_1_id",
                "print_side": "sleeve",
            },
            "print_side must be one of: front, back, left, right",
        ),
        (
            {
                "print_id": "print_1_id",
                "print_text": "TEAM",
            },
            "print_text and print_font must be provided together",
        ),
    ],
)
def test_create_order_rejects_invalid_print_payload(api_fixture, payload, expected_detail):
    client, _session_local, ids = api_fixture

    request_body = {
        "client": {"name": "Print Validation", "phone": "+76666666666"},
        "model_id": ids["model_1_id"],
        "size_id": ids["size_1_id"],
    }

    resolved_payload = {}
    for key, value in payload.items():
        if isinstance(value, str) and value in ids:
            resolved_payload[key] = ids[value]
        else:
            resolved_payload[key] = value

    request_body.update(resolved_payload)

    response = client.post("/orders/", json=request_body)

    assert response.status_code == 400
    assert expected_detail in response.json()["detail"]


def test_create_order_rejects_text_print_without_text(api_fixture):
    client, _session_local, ids = api_fixture

    response = client.post(
        "/orders/",
        json={
            "client": {"name": "Text Print", "phone": "+77777777777"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
            "print_id": ids["print_text_id"],
        },
    )

    assert response.status_code == 400
    assert "Text print requires print_text" in response.json()["detail"]


def test_update_order_catalog_rejects_invalid_print_payload(api_fixture):
    client, _session_local, ids = api_fixture

    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Update Print", "phone": "+78888888888"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
            "print_id": ids["print_1_id"],
        },
    )
    assert create_response.status_code == 200
    order_id = create_response.json()["id"]

    update_response = client.put(
        f"/orders/{order_id}/catalog",
        json={"print_x": -1, "print_y": 10},
    )

    assert update_response.status_code == 400
    assert "print_x must be >= 0" in update_response.json()["detail"]


def test_cancel_request_sets_status_reason_and_logs_event(api_fixture):
    client, session_local, ids = api_fixture

    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Cancel Req", "phone": "+79995550001"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
        },
    )
    assert create_response.status_code == 200
    order_id = create_response.json()["id"]

    response = client.post(
        f"/orders/{order_id}/cancel_request",
        json={"reason": "Client changed mind"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "cancel_requested"
    assert body["cancel_reason"] == "Client changed mind"
    assert body["cancel_requested_by_user_id"] is not None

    db = session_local()
    event = (
        db.query(OrderEvent)
        .filter(OrderEvent.order_id == order_id, OrderEvent.event_type == "cancel_requested")
        .first()
    )
    assert event is not None
    db.close()


def test_cancel_approve_moves_order_to_canceled(api_fixture):
    client, session_local, ids = api_fixture

    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Cancel Approve", "phone": "+79995550002"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
        },
    )
    assert create_response.status_code == 200
    order_id = create_response.json()["id"]

    request_response = client.post(
        f"/orders/{order_id}/cancel_request",
        json={"reason": "Wrong order"},
    )
    assert request_response.status_code == 200

    approve_response = client.post(f"/orders/{order_id}/cancel_approve")
    assert approve_response.status_code == 200
    body = approve_response.json()
    assert body["status"] == "canceled"
    assert body["canceled_by_user_id"] is not None
    assert body["canceled_at"] is not None
    assert body["cancel_requested_by_user_id"] is None
    assert body["cancel_requested_at"] is None

    db = session_local()
    event = (
        db.query(OrderEvent)
        .filter(OrderEvent.order_id == order_id, OrderEvent.event_type == "cancel_approved")
        .first()
    )
    assert event is not None
    db.close()


def test_cancel_reject_returns_order_to_previous_status(api_fixture):
    client, session_local, ids = api_fixture

    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Cancel Reject", "phone": "+79995550003"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
        },
    )
    assert create_response.status_code == 200
    order_id = create_response.json()["id"]

    request_response = client.post(
        f"/orders/{order_id}/cancel_request",
        json={"reason": "Need review"},
    )
    assert request_response.status_code == 200
    assert request_response.json()["status"] == "cancel_requested"

    reject_response = client.post(f"/orders/{order_id}/cancel_reject")
    assert reject_response.status_code == 200
    body = reject_response.json()
    assert body["status"] == "new"
    assert body["cancel_reason"] is None
    assert body["cancel_requested_by_user_id"] is None
    assert body["cancel_requested_at"] is None

    db = session_local()
    event = (
        db.query(OrderEvent)
        .filter(OrderEvent.order_id == order_id, OrderEvent.event_type == "cancel_rejected")
        .first()
    )
    assert event is not None
    db.close()


def test_cancel_request_rejects_issued_order(api_fixture):
    client, session_local, ids = api_fixture

    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Issued Cancel", "phone": "+79995550004"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
        },
    )
    assert create_response.status_code == 200
    order_id = create_response.json()["id"]

    db = session_local()
    order = db.query(Order).filter(Order.id == order_id).first()
    assert order is not None
    order.status = OrderStatus.ISSUED.value
    db.commit()
    db.close()

    response = client.post(
        f"/orders/{order_id}/cancel_request",
        json={"reason": "Too late"},
    )

    assert response.status_code == 400
    assert "Cannot request cancel from status issued" in response.json()["detail"]


def test_cancel_request_requires_non_empty_reason(api_fixture):
    client, _session_local, ids = api_fixture

    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Cancel Empty", "phone": "+79995550005"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
        },
    )
    assert create_response.status_code == 200
    order_id = create_response.json()["id"]

    response = client.post(
        f"/orders/{order_id}/cancel_request",
        json={"reason": "   "},
    )

    assert response.status_code == 400
    assert "Cancel reason is required" in response.json()["detail"]


def test_cancel_reject_rejects_non_cancel_requested_status(api_fixture):
    client, _session_local, ids = api_fixture

    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Reject Invalid", "phone": "+79995550006"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
        },
    )
    assert create_response.status_code == 200
    order_id = create_response.json()["id"]

    response = client.post(f"/orders/{order_id}/cancel_reject")

    assert response.status_code == 400
    assert "Cancel can only be rejected from cancel_requested status" in response.json()["detail"]


@pytest.mark.parametrize(
    "role,path,payload",
    [
        (Role.RECEPTION, "/orders/999/take_print", None),
        (Role.PRINT, "/orders/999/take_nanesenie", None),
        (Role.PRINT, "/orders/999/start_delivery", None),
        (Role.RECEPTION, "/orders/999/issue", None),
        (Role.PRINT, "/orders/999/cancel_request", {"reason": "no rights"}),
        (Role.PRINT, "/orders/999/cancel_approve", None),
        (Role.PRINT, "/orders/999/cancel_reject", None),
    ],
)

def test_role_restrictions_for_production_endpoints(api_fixture, role, path, payload):
    client, _session_local, _ids = api_fixture
    set_current_user_role(role)

    response = client.post(path, json=payload) if payload is not None else client.post(path)

    assert response.status_code == 403

def test_smoke_order_lifecycle_happy_path(api_fixture):
    client, _session_local, ids = api_fixture

    # 1) create
    create_response = client.post(
        "/orders/",
        json={
            "client": {"name": "Smoke User", "phone": "+79996667788"},
            "model_id": ids["model_1_id"],
            "size_id": ids["size_1_id"],
            "print_id": ids["print_1_id"],
        },
    )
    assert create_response.status_code == 200
    order_payload = create_response.json()
    order_id = order_payload["id"]
    assert order_payload["status"] == "new"

    confirm_response = client.put(f"/orders/{order_id}", json={"status": "confirmed"})
    assert confirm_response.status_code == 200
    confirmed_payload = confirm_response.json()
    assert confirmed_payload["status"] == "confirmed"
    assert confirmed_payload["time_confirmed"] is not None

    take_print_response = client.post(f"/orders/{order_id}/take_print")
    assert take_print_response.status_code == 200
    printing_payload = take_print_response.json()
    assert printing_payload["status"] == "printing"
    assert printing_payload["print_master_id"] is not None
    assert printing_payload["time_print_started"] is not None

    finish_print_response = client.post(f"/orders/{order_id}/finish_print")
    assert finish_print_response.status_code == 200
    printed_payload = finish_print_response.json()
    assert printed_payload["status"] == "printed"
    assert printed_payload["time_print_finished"] is not None

    take_nanesenie_response = client.post(f"/orders/{order_id}/take_nanesenie")
    assert take_nanesenie_response.status_code == 200
    nanesenie_payload = take_nanesenie_response.json()
    assert nanesenie_payload["status"] == "nanesenie"
    assert nanesenie_payload["nanesenie_master_id"] is not None

    finish_nanesenie_response = client.post(f"/orders/{order_id}/finish_nanesenie")
    assert finish_nanesenie_response.status_code == 200
    nanesenie_done_payload = finish_nanesenie_response.json()
    assert nanesenie_done_payload["status"] == "nanesenie_done"

    start_delivery_response = client.post(f"/orders/{order_id}/start_delivery")
    assert start_delivery_response.status_code == 200
    delivering_payload = start_delivery_response.json()
    assert delivering_payload["status"] == "delivering"

    issue_response = client.post(f"/orders/{order_id}/issue")
    assert issue_response.status_code == 200
    issued_payload = issue_response.json()
    assert issued_payload["status"] == "issued"
    assert issued_payload["issue_master_id"] is not None
    assert issued_payload["time_issued"] is not None
