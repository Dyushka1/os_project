from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from auth import get_current_user, get_current_user_optional, require_active_session, require_roles
from models.users import User, Role
from schemas.orders import (
    OrderCreate, OrderRead, OrderUpdate, OrderCatalogUpdate, OrderCancelRequest,
    PrintMasterTaskRead, NanesenieMasterTaskRead
)
from schemas.clients import ClientCreate, ClientRead
from database import get_db
from models.clients import Client
from models.orders import Order, OrderStatus, validate_status_transition, validate_cancel_request, validate_cancel_approve
from models.catalog_model_sizes import CatalogModelSize
from models.catalog_models import CatalogModel
from models.catalog_sizes import CatalogSize
from models.catalog_prints import CatalogPrint
from models.catalog_colors import CatalogColors
from models.sessions import SessionModel
from datetime import datetime, timezone
from models.order_events import OrderEvent 
router = APIRouter(prefix="/orders", tags=["orders"])

TEXT_PRINT_TYPES = {"text", "custom_text", "own_text", "own-text"}
ALLOWED_PRINT_SIDES = {"front", "back"}
ALLOWED_NOTIFY_METHODS = {"sms", "email", "whatsapp", "viber", "telegram", "none"}


# ==================== Helper functions to convert Order to Master task schemas ====================

def _build_print_master_task(order: Order, db: Session) -> PrintMasterTaskRead:
    """Convert an Order to PrintMasterTaskRead with resolved catalog names."""
    model_name = None
    size_code = None
    color_name = None
    front_image_url = None
    back_image_url = None
    print_name = None
    print_type = None
    print_image_url = None

    if order.model_id:
        model = db.query(CatalogModel).filter(CatalogModel.id == order.model_id).first()
        if model:
            model_name = model.name
            front_image_url = model.front_image_url
            back_image_url = model.back_image_url

    if order.size_id:
        size = db.query(CatalogSize).filter(CatalogSize.id == order.size_id).first()
        if size:
            size_code = size.code

    if order.color_id:
        color = db.query(CatalogColors).filter(CatalogColors.id == order.color_id).first()
        if color:
            color_name = color.name

    if order.print_id:
        catalog_print = db.query(CatalogPrint).filter(CatalogPrint.id == order.print_id).first()
        if catalog_print:
            print_name = catalog_print.name
            print_type = catalog_print.print_type
            print_image_url = catalog_print.image_url
    elif order.print_text:
        print_type = "custom_text"

    return PrintMasterTaskRead(
        id=order.id,
        order_id=order.id,
        order_number=get_session_order_number(db, order),
        model_name=model_name,
        size_code=size_code,
        color_name=color_name,
        print_id=order.print_id,
        print_name=print_name,
        print_type=print_type,
        print_image_url=print_image_url,
        print_side=order.print_side,
        print_x=order.print_x,
        print_y=order.print_y,
        print_angle=order.print_angle,
        print_scale=order.print_scale,
        print_text=order.print_text,
        print_font=order.print_font,
        front_image_url=front_image_url,
        back_image_url=back_image_url,
    )


def _build_nanesenie_master_task(order: Order, db: Session) -> NanesenieMasterTaskRead:
    """Convert an Order to NanesenieMasterTaskRead with resolved catalog names."""
    model_name = None
    size_code = None
    color_name = None
    print_name = None
    print_type = None
    print_image_url = None
    front_image_url = None
    back_image_url = None

    if order.model_id:
        model = db.query(CatalogModel).filter(CatalogModel.id == order.model_id).first()
        if model:
            model_name = model.name
            front_image_url = model.front_image_url
            back_image_url = model.back_image_url

    if order.size_id:
        size = db.query(CatalogSize).filter(CatalogSize.id == order.size_id).first()
        if size:
            size_code = size.code

    if order.color_id:
        color = db.query(CatalogColors).filter(CatalogColors.id == order.color_id).first()
        if color:
            color_name = color.name

    print_width = None
    print_height = None

    if order.print_id:
        catalog_print = db.query(CatalogPrint).filter(CatalogPrint.id == order.print_id).first()
        if catalog_print:
            print_name = catalog_print.name
            print_type = catalog_print.print_type
            print_image_url = catalog_print.image_url
            print_width = catalog_print.width
            print_height = catalog_print.height
    elif order.print_text:
        print_type = "custom_text"

    return NanesenieMasterTaskRead(
        id=order.id,
        order_id=order.id,
        order_number=get_session_order_number(db, order),
        model_name=model_name,
        size_code=size_code,
        color_name=color_name,
        print_id=order.print_id,
        print_name=print_name,
        print_type=print_type,
        print_image_url=print_image_url,
        print_text=order.print_text,
        print_font=order.print_font,
        print_side=order.print_side,
        print_x=order.print_x,
        print_y=order.print_y,
        print_angle=order.print_angle,
        print_scale=order.print_scale,
        print_width=print_width,
        print_height=print_height,
        front_image_url=front_image_url,
        back_image_url=back_image_url,
    )





def get_user_client_marker(user_id: int) -> str:
    return f"user:{user_id}"


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc

def log_order_event(db: Session, order_id: int, event_type: str, user_id: int | None = None) -> None:
    event = OrderEvent(order_id = order_id,
                       event_type = event_type,
                       user_id = user_id,
                       created_at = datetime.now(timezone.utc))
    db.add(event)


def get_order_or_404(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    return order


def clear_cancel_request_fields(order: Order) -> None:
    order.cancel_requested_from_status = None
    order.cancel_requested_at = None
    order.cancel_requested_by_user_id = None


def get_order_session(db: Session, order: Order) -> SessionModel:
    if order.session_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order has no session attached",
        )
    session = db.query(SessionModel).filter(SessionModel.id == order.session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session for order not found",
        )
    return session


def get_session_order_number(db: Session, order: Order) -> int | None:
    if order.session_id is None:
        return None
    return db.query(Order).filter(Order.session_id == order.session_id, Order.id <= order.id).count()


def serialize_order(order: Order, db: Session) -> dict:
    client = None
    if order.client_id is not None:
        client_obj = db.query(Client).filter(Client.id == order.client_id).first()
        if client_obj is not None:
          client = ClientRead.model_validate(client_obj).model_dump()

    return {
        "id": order.id,
        "order_number": get_session_order_number(db, order),
        "client_id": order.client_id,
        "client": client,
        "status": order.status,
        "print_master_id": order.print_master_id,
        "nanesenie_master_id": order.nanesenie_master_id,
        "issue_master_id": order.issue_master_id,
        "cancel_reason": order.cancel_reason,
        "cancel_requested_by_user_id": order.cancel_requested_by_user_id,
        "cancel_requested_at": order.cancel_requested_at,
        "canceled_by_user_id": order.canceled_by_user_id,
        "canceled_at": order.canceled_at,
        "time_confirmed": order.time_confirmed,
        "time_print_started": order.time_print_started,
        "time_print_finished": order.time_print_finished,
        "time_issued": order.time_issued,
        "promo_code": order.promo_code,
        "notify_method": order.notify_method,
        "notify_contact": order.notify_contact,
        "print_text": order.print_text,
        "print_font": order.print_font,
        "print_side": order.print_side,
        "print_x": order.print_x,
        "print_y": order.print_y,
        "print_angle": order.print_angle,
        "print_scale": order.print_scale,
        "color_id": order.color_id,
        "model_id": order.model_id,
        "size_id": order.size_id,
        "print_id": order.print_id,
        "session_id": order.session_id,
    }


def validate_print_payload(
    print_type: str | None,
    print_text: str | None,
    print_font: str | None,
    print_side: str | None,
    print_x: int | None,
    print_y: int | None,
    print_angle: float | None,
    print_scale: int | None,
) -> None:
    if (print_x is None) != (print_y is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="print_x and print_y must be provided together",
        )
    if print_x is not None and print_x < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="print_x must be >= 0",
        )
    if print_y is not None and print_y < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="print_y must be >= 0",
        )
    if print_angle is not None and (print_angle < -180 or print_angle > 180):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="print_angle must be between -180 and 180",
        )
    if print_side is not None and print_side not in ALLOWED_PRINT_SIDES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="print_side must be one of: front, back",
        )
    if print_scale is not None and (print_scale < 20 or print_scale > 250):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="print_scale must be between 20 and 250",
        )
    if bool(print_text) != bool(print_font):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="print_text and print_font must be provided together",
        )
    if print_type in TEXT_PRINT_TYPES and not print_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text print requires print_text",
        )


def validate_phone_payload(phone: str | None) -> None:
    if not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client.phone is required when creating client inline",
        )
    if any(char.isalpha() for char in phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client.phone must contain only digits and symbols +()-",
        )
    digits = "".join(char for char in phone if char.isdigit())
    if len(digits) < 10 or len(digits) > 15:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client.phone must contain between 10 and 15 digits",
        )


def validate_notify_payload(notify_method: str | None, notify_contact: str | None) -> None:
    if notify_method is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="notify_method is required",
        )
    if notify_method not in ALLOWED_NOTIFY_METHODS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="notify_method must be one of: sms, email, whatsapp, viber, telegram, none",
        )
    if notify_method != "none" and not (notify_contact and notify_contact.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="notify_contact is required when notify_method is not none",
        )
    
    
def get_or_create_client(db: Session, client_data: ClientCreate) -> int:
    client = None
    if client_data.phone:
        client = db.query(Client).filter_by(phone=client_data.phone).first()
    elif client_data.email:
        client = db.query(Client).filter_by(email=client_data.email).first()

    if not client:
        client = Client(
            name=client_data.name,
            phone=client_data.phone,
            email=client_data.email
        )
        db.add(client)
        commit_with_rollback(db)
        db.refresh(client)
    return client.id


def resolve_client_id(db: Session, client_id: int | None, client_data: ClientCreate | None) -> int:
    if client_data:
        if not client_data.phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="client.phone is required when creating client inline",
            )
        return get_or_create_client(db, client_data)
    if client_id:
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Client with id {client_id} not found",
            )
        return client_id
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Either client_id or client data must be provided",
    )
@router.get("/search", response_model=list[OrderRead])
def search_orders(
    q: str | None = Query(default=None),
    order_status: OrderStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION, Role.ISSUE, Role.PRINT, Role.NANESENIE])

    query = db.query(Order).outerjoin(Client, Client.id == Order.client_id)

    if q:
        q_value = q.strip()
        if q_value:
            filters = []
            if q_value.isdigit():
                n = int(q_value)
                active_session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
                if active_session:
                    target_id = (
                        db.query(Order.id)
                        .filter(Order.session_id == active_session.id)
                        .order_by(Order.id)
                        .offset(n - 1)
                        .limit(1)
                        .scalar()
                    )
                    if target_id is not None:
                        filters.append(Order.id == target_id)
                else:
                    filters.append(Order.id == n)

            like_value = f"%{q_value}%"
            filters.append(Client.name.ilike(like_value))
            filters.append(Client.phone.ilike(like_value))
            filters.append(Order.promo_code.ilike(like_value))

            query = query.filter(or_(*filters))

    if order_status is not None:
        query = query.filter(Order.status == order_status.value)

    return [serialize_order(order, db) for order in query.order_by(Order.id.desc()).limit(limit).all()]


@router.get("/my", response_model=list[OrderRead])
def get_my_orders(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.USER, Role.ADMIN])

    if current_user.role == Role.ADMIN:
        return [serialize_order(order, db) for order in db.query(Order).order_by(Order.id.desc()).limit(limit).all()]

    client = db.query(Client).filter(Client.email == get_user_client_marker(current_user.id)).first()
    if not client:
        return []

    orders = (
        db.query(Order)
        .filter(Order.client_id == client.id)
        .order_by(Order.id.desc())
        .limit(limit)
        .all()
    )
    return [serialize_order(order, db) for order in orders]
        


@router.get("/", response_model=list[OrderRead])
def list_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN, Role.USER])
    orders = db.query(Order).all()
    return [serialize_order(order, db) for order in orders]

@router.get("/{order_id}" , response_model=OrderRead)
def get_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN, Role.USER, Role.RECEPTION, Role.ISSUE])
    order = db.query(Order).filter(Order.id== order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    return serialize_order(order, db)

@router.post("/", response_model=OrderRead)
def create_order(order: OrderCreate,
                 db: Session = Depends(get_db),
                 current_user: User | None = Depends(get_current_user_optional),
                 session = Depends(require_active_session)
                 ):
    # Allow anonymous (kiosk) clients to create orders by providing inline client data.
    is_client_user = (current_user is not None and current_user.role == Role.USER)

    if not is_client_user:
        # For non-client users (staff) or anonymous callers, require explicit client info
        if order.client_id is None and order.client is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either client_id or client data must be provided",
            )
        if order.client_id is not None and order.client is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide either client_id or client data, not both",
            )
    
    model = db.query(CatalogModel).filter(CatalogModel.id == order.model_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model with id {order.model_id} not found",
        )
    if not model.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected model is inactive",
        )

    model_and_size = db.query(CatalogModelSize).filter(CatalogModelSize.size_id == order.size_id, CatalogModelSize.model_id == order.model_id).first()
    if not model_and_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid size or model provided",
        )
    if not model_and_size.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected model and size combination is inactive",
        )

    size = db.query(CatalogSize).filter(CatalogSize.id == order.size_id).first()
    if not size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Size with id {order.size_id} not found",
        )
    if not size.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected size is inactive",
        )

    if model_and_size.stock_qty <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected model and size combination is out of stock",
        )

    if order.print_id is not None:
        catalog_print = db.query(CatalogPrint).filter(CatalogPrint.id == order.print_id).first()
        if not catalog_print:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Print with id {order.print_id} not found",
            )
        if not catalog_print.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected print is inactive",
            )

    selected_print_type = catalog_print.print_type if order.print_id is not None else None
    validate_notify_payload(order.notify_method, order.notify_contact)

    if order.client is not None:
        validate_phone_payload(order.client.phone)

    validate_print_payload(
        print_type=selected_print_type,
        print_text=order.print_text,
        print_font=order.print_font,
        print_side=order.print_side,
        print_x=order.print_x,
        print_y=order.print_y,
        print_angle=order.print_angle,
        print_scale=order.print_scale,
    )

    resolved_color_id = order.color_id if order.color_id is not None else model.color_id
    if resolved_color_id != model.color_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided color_id does not match selected model",
        )
    color = db.query(CatalogColors).filter(CatalogColors.id == resolved_color_id).first()
    if not color:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Color with id {resolved_color_id} not found",
        )
    if not color.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected color is inactive",
        )

    if is_client_user:
        client_payload = ClientCreate(
            name=(order.client.name if order.client and order.client.name else current_user.username),
            phone=(order.client.phone if order.client else None),
            email=get_user_client_marker(current_user.id),
        )
        client_id = get_or_create_client(db, client_payload)
    else:
        client_id = resolve_client_id(db, order.client_id, order.client)
    new_order = Order(client_id = client_id,
                      status=OrderStatus.NEW.value,
                      session_id=session.id,
                      color_id=resolved_color_id,
                      model_id=order.model_id,
                      size_id=order.size_id,
                      print_id=order.print_id,
                      promo_code=order.promo_code,
                      notify_method=order.notify_method,
                      notify_contact=order.notify_contact,
                      print_text=order.print_text,
                      print_font=order.print_font,
                      print_side=order.print_side,
                      print_x=order.print_x,
                      print_y=order.print_y,
                      print_angle=order.print_angle,
                      print_scale=order.print_scale,)
    model_and_size.stock_qty -= 1
    db.add(new_order)
    db.flush()
    log_order_event(db, new_order.id, "order_created", user_id=(current_user.id if current_user is not None else None))
    commit_with_rollback(db)
    db.refresh(new_order)
    return serialize_order(new_order, db)


@router.put("/{order_id}", response_model=OrderRead)
def update_order(order_id: int,
                 data: OrderUpdate,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    order = db.query(Order).filter(Order.id== order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )

    if data.status is not None:
        validate_status_transition(order.status, data.status.value)
        order.status = data.status.value
        if data.status == OrderStatus.CONFIRMED:
            order.time_confirmed = datetime.now(timezone.utc)
            log_order_event(db, order.id, "order_confirmed", user_id=current_user.id)
        
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)

@router.put("/{order_id}/catalog", response_model=OrderRead)
def update_order_catalog(order_id: int,
                         data: OrderCatalogUpdate,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    order = db.query(Order).filter(Order.id== order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    if order.status != OrderStatus.NEW.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only orders in NEW status can be updated",
        )

    new_model_id = data.model_id if data.model_id is not None else order.model_id
    new_size_id = data.size_id if data.size_id is not None else order.size_id

    new_model = db.query(CatalogModel).filter(CatalogModel.id == new_model_id).first()
    if not new_model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model with id {new_model_id} not found",
        )
    if not new_model.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected model is inactive",
        )

    new_size = db.query(CatalogSize).filter(CatalogSize.id == new_size_id).first()
    if not new_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Size with id {new_size_id} not found",
        )
    if not new_size.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected size is inactive",
        )

    new_model_size = (
        db.query(CatalogModelSize)
        .filter(
            CatalogModelSize.model_id == new_model_id,
            CatalogModelSize.size_id == new_size_id,
        )
        .first()
    )
    if not new_model_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid model_id or size_id provided",
        )
    if not new_model_size.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected model and size combination is inactive",
        )
    
    resolved_color_id = data.color_id if data.color_id is not None else new_model.color_id
    if resolved_color_id != new_model.color_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided color_id does not match selected model",
        )
    color = db.query(CatalogColors).filter(CatalogColors.id == resolved_color_id).first()
    if not color:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Color with id {resolved_color_id} not found",
        )
    if not color.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected color is inactive",
        )

    selected_print_id = data.print_id if data.print_id is not None else order.print_id
    selected_print = None
    if selected_print_id is not None:
        selected_print = db.query(CatalogPrint).filter(CatalogPrint.id == selected_print_id).first()
        if not selected_print:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Print with id {selected_print_id} not found",
            )
        if not selected_print.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected print is inactive",
            )

    new_print_text = data.print_text if data.print_text is not None else order.print_text
    new_print_font = data.print_font if data.print_font is not None else order.print_font
    new_print_side = data.print_side if data.print_side is not None else order.print_side
    new_print_x = data.print_x if data.print_x is not None else order.print_x
    new_print_y = data.print_y if data.print_y is not None else order.print_y
    new_print_angle = data.print_angle if data.print_angle is not None else order.print_angle
    new_print_scale = data.print_scale if data.print_scale is not None else order.print_scale

    validate_print_payload(
        print_type=selected_print.print_type if selected_print is not None else None,
        print_text=new_print_text,
        print_font=new_print_font,
        print_side=new_print_side,
        print_x=new_print_x,
        print_y=new_print_y,
        print_angle=new_print_angle,
        print_scale=new_print_scale,
    )

    old_model_size = (
        db.query(CatalogModelSize)
        .filter(
            CatalogModelSize.model_id == order.model_id,
            CatalogModelSize.size_id == order.size_id,
        )
        .first()
    )
    if not old_model_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current order model-size combination is invalid",
        )

    is_model_size_changed = (
        order.model_id != new_model_id
        or order.size_id != new_size_id
    )
    if is_model_size_changed:
        if new_model_size.stock_qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected model and size combination is out of stock",
            )
        old_model_size.stock_qty += 1
        new_model_size.stock_qty -= 1

    order.color_id = resolved_color_id
    order.model_id = new_model_id
    order.size_id = new_size_id
    if data.print_id is not None:
        order.print_id = data.print_id
    if data.print_text is not None:
        order.print_text = data.print_text
    if data.print_font is not None:
        order.print_font = data.print_font
    if data.print_side is not None:
        order.print_side = data.print_side
    if data.print_x is not None:
        order.print_x = data.print_x
    if data.print_y is not None:
        order.print_y = data.print_y
    if data.print_angle is not None:
        order.print_angle = data.print_angle
    if data.print_scale is not None:
        order.print_scale = data.print_scale

    log_order_event(db, order.id, "order_catalog_updated", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)
    
    
                        
                            

# DEPRECATED ENDPOINTS: These were used before refactoring the workflow order
# The correct workflow is now:
# 1. After order confirmation → goes to NANESENIE (if session has prints to make) or PRINTING (if using pre-made prints)
# 2. NANESENIE stage: Nanesenie master makes the print design
# 3. PRINTING stage: Print master applies the print to the garment
# The endpoints below should not be used. Use /next/nanesenie and /next/printing instead


# @router.post("/{order_id}/take_print", response_model=OrderRead)
# def take_print(
#     order_id: int,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
#     session = Depends(require_active_session),
#     ):
#     DEPRECATED - use /next/nanesenie instead


@router.post("/{order_id}/take_print", response_model=OrderRead)
def take_print(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session = Depends(require_active_session),
    ):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])

    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    if order.print_master_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order {order_id} is already taken for printing",
        )
        
    if current_user.role == Role.PRINT:
        active_order = (
            db.query(Order)
            .filter(
                Order.print_master_id == current_user.id,
                Order.status == OrderStatus.PRINTING.value,
            )
            .first()
        )
        if active_order:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have an active print order",
            )
    
    if order.status != OrderStatus.CONFIRMED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order status must be CONFIRMED, but is {order.status}",
        )
        
    order.print_master_id = current_user.id
    order.status = OrderStatus.PRINTING.value
    log_order_event(db, order.id, "print_started", user_id=current_user.id)
    order.time_print_started = datetime.now(timezone.utc)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)
    

    



@router.post("/{order_id}/start_delivery", response_model=OrderRead)
def start_delivery(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session = Depends(require_active_session),
    ):
    require_roles(current_user, [Role.ADMIN, Role.ISSUE])
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )

    if order.status not in (OrderStatus.PRINTED.value, OrderStatus.NANESENIE_DONE.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Заказ должен быть напечатан или завершён на нанесении перед выдачей",
        )
    
    order.status = OrderStatus.DELIVERING.value
    log_order_event(db, order.id, "delivery_started", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)

@router.post("/{order_id}/issue", response_model=OrderRead)
def issue_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session = Depends(require_active_session),
):
    require_roles(current_user, [Role.ADMIN, Role.ISSUE])

    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )

    if order.status != OrderStatus.DELIVERING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is not currently being delivered",
        )

    if order.issue_master_id is None:
        order.issue_master_id = current_user.id

    order.status = OrderStatus.ISSUED.value
    log_order_event(db, order.id, "issued", user_id=current_user.id)
    order.time_issued = datetime.now(timezone.utc)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)


@router.get("/queue/issue", response_model=list[OrderRead])
def get_issue_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.ISSUE, Role.RECEPTION])
    ready_statuses = [
        OrderStatus.PRINTED.value,
        OrderStatus.DELIVERING.value,
    ]
    orders = (
        db.query(Order)
        .filter(Order.status.in_(ready_statuses))
        .order_by(Order.id.asc())
        .all()
    )
    return [serialize_order(o, db) for o in orders]


@router.get("/queue/nanesenie", response_model=list[OrderRead])
def get_nanesenie_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.NANESENIE, Role.RECEPTION])
    # Очередь нанесения: заказы в CONFIRMED статусе, только если сессия производит нанесения
    queue = (
        db.query(Order)
        .join(SessionModel, SessionModel.id == Order.session_id)
        .filter(
            SessionModel.has_nanesenie.is_(True),
            Order.nanesenie_master_id.is_(None),
            Order.status == OrderStatus.CONFIRMED.value,
        )
        .order_by(Order.id.asc())
        .all()
    )
    return [serialize_order(order, db) for order in queue]

@router.post("/{order_id}/take_nanesenie", response_model=OrderRead)
def take_nanesenie(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session = Depends(require_active_session),
):
    require_roles(current_user, [Role.ADMIN, Role.NANESENIE])

    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )

    order_session = get_order_session(db, order)
    if not order_session.has_nanesenie:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nanesenie stage is disabled for this session",
        )

    if order.nanesenie_master_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order {order_id} is already taken for nanesenie",
        )

    if order.status != OrderStatus.CONFIRMED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must be in CONFIRMED status to start nanesenie",
        )

    order.nanesenie_master_id = current_user.id
    order.status = OrderStatus.NANESENIE.value
    log_order_event(db, order.id, "nanesenie_started", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)

@router.post("/{order_id}/finish_nanesenie", response_model=OrderRead)
def finish_nanesenie(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session = Depends(require_active_session),
):
    require_roles(current_user, [Role.ADMIN, Role.NANESENIE])

    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )

    order_session = get_order_session(db, order)
    if not order_session.has_nanesenie:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nanesenie stage is disabled for this session",
        )

    if order.status != OrderStatus.NANESENIE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is not currently in nanesenie",
        )

    if current_user.role != Role.ADMIN and order.nanesenie_master_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned nanesenie master or admin can finish this order",
        )

    order.status = OrderStatus.NANESENIE_DONE.value
    log_order_event(db, order.id, "nanesenie_finished", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)


@router.post("/{order_id}/release_nanesenie", response_model=OrderRead)
def release_nanesenie_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.NANESENIE])

    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )

    if order.status != OrderStatus.NANESENIE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is not currently in nanesenie",
        )

    if order.nanesenie_master_id != current_user.id and current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned nanesenie master or admin can release this order",
        )

    order.nanesenie_master_id = None
    order.status = OrderStatus.PRINTED.value
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)

@router.get("/board/status", response_model=list[OrderRead])
def get_board(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION, Role.PRINT, Role.NANESENIE, Role.ISSUE])
    active_statuses = [
        OrderStatus.CONFIRMED.value,
        OrderStatus.PRINTING.value,
        OrderStatus.PRINTED.value,
        OrderStatus.NANESENIE.value,
        OrderStatus.NANESENIE_DONE.value,
        OrderStatus.DELIVERING.value,
    ]
    orders = (
        db.query(Order)
        .filter(Order.status.in_(active_statuses))
        .order_by(Order.id.asc())
        .all()
    )
    return [serialize_order(order, db) for order in orders]


@router.post("/next/nanesenie", response_model=NanesenieMasterTaskRead)
def get_next_nanesenie_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.NANESENIE])

    if current_user.role == Role.NANESENIE:
        active_order = (
            db.query(Order)
            .filter(
                Order.nanesenie_master_id == current_user.id,
                Order.status == OrderStatus.NANESENIE.value,
            )
            .first()
        )
        if active_order:
            return _build_nanesenie_master_task(active_order, db)

    order = (
        db.query(Order)
        .join(SessionModel, SessionModel.id == Order.session_id)
        .filter(
            SessionModel.has_nanesenie.is_(True),
            Order.nanesenie_master_id.is_(None),
            Order.status == OrderStatus.CONFIRMED.value,
        )
        .order_by(Order.id.asc())
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nanesenie queue is empty",
        )

    order.nanesenie_master_id = current_user.id
    order.status = OrderStatus.NANESENIE.value
    log_order_event(db, order.id, "nanesenie_started", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(order)
    return _build_nanesenie_master_task(order, db)


@router.get("/my/nanesenie", response_model=NanesenieMasterTaskRead)
def get_my_active_nanesenie_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.NANESENIE])

    order = (
        db.query(Order)
        .filter(
            Order.nanesenie_master_id == current_user.id,
            Order.status == OrderStatus.NANESENIE.value,
        )
        .first()
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active nanesenie order",
        )
    return _build_nanesenie_master_task(order, db)


# ==================== Endpoints for Printing Master (мастер печати) ====================

@router.get("/queue/printing", response_model=list[OrderRead])
def get_printing_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.PRINT, Role.RECEPTION])

    # Для каждой сессии определяем, какие статусы готовых заказов видны на печать
    # Если есть нанесение: NANESENIE_DONE
    # Если нет нанесения: CONFIRMED
    queue = (
        db.query(Order)
        .outerjoin(SessionModel, SessionModel.id == Order.session_id)
        .filter(
            Order.print_master_id.is_(None),
            or_(
                and_(SessionModel.has_nanesenie.is_(True), Order.status == OrderStatus.NANESENIE_DONE.value),
                and_(SessionModel.has_nanesenie.is_(False), Order.status == OrderStatus.CONFIRMED.value),
            ),
        )
        .order_by(Order.id.asc())
        .all()
    )
    return queue


@router.post("/{order_id}/take_printing", response_model=OrderRead)
def take_printing_task(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session = Depends(require_active_session),
):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])

    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    
    if order.print_master_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order {order_id} is already assigned for printing",
        )
        
    if current_user.role == Role.PRINT:
        active_order = (
            db.query(Order)
            .filter(
                Order.print_master_id == current_user.id,
                Order.status == OrderStatus.PRINTING.value,
            )
            .first()
        )
        if active_order:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have an active printing task",
            )
    
    if order.status not in {OrderStatus.NANESENIE_DONE.value, OrderStatus.CONFIRMED.value}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order status must be NANESENIE_DONE or CONFIRMED, but is {order.status}",
        )
        
    order.print_master_id = current_user.id
    order.status = OrderStatus.PRINTING.value
    log_order_event(db, order.id, "printing_started", user_id=current_user.id)
    order.time_print_started = datetime.now(timezone.utc)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)


@router.post("/next/printing", response_model=PrintMasterTaskRead)
def get_next_printing_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])

    if current_user.role == Role.PRINT:
        active_order = (
            db.query(Order)
            .filter(
                Order.print_master_id == current_user.id,
                Order.status == OrderStatus.PRINTING.value,
            )
            .first()
        )
        if active_order:
            return _build_print_master_task(active_order, db)

    order = (
        db.query(Order)
        .outerjoin(SessionModel, SessionModel.id == Order.session_id)
        .filter(
            Order.print_master_id.is_(None),
            or_(
                and_(SessionModel.has_nanesenie.is_(True), Order.status == OrderStatus.NANESENIE_DONE.value),
                and_(SessionModel.has_nanesenie.is_(False), Order.status == OrderStatus.CONFIRMED.value),
            ),
        )
        .order_by(Order.id.asc())
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Printing queue is empty",
        )

    order.print_master_id = current_user.id
    order.status = OrderStatus.PRINTING.value
    log_order_event(db, order.id, "printing_started", user_id=current_user.id)
    order.time_print_started = datetime.now(timezone.utc)
    commit_with_rollback(db)
    db.refresh(order)
    return _build_print_master_task(order, db)


@router.get("/my/printing", response_model=PrintMasterTaskRead)
def get_my_active_printing_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])

    order = (
        db.query(Order)
        .filter(
            Order.print_master_id == current_user.id,
            Order.status == OrderStatus.PRINTING.value,
        )
        .first()
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active printing task",
        )
    return _build_print_master_task(order, db)


@router.post("/{order_id}/finish_printing", response_model=OrderRead)
def finish_printing_task(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session = Depends(require_active_session),
):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    
    if order.status != OrderStatus.PRINTING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is not currently being printed",
        )
    
    if order.print_master_id != current_user.id and current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned printing master or admin can finish this task",
        )
    
    order.status = OrderStatus.PRINTED.value
    log_order_event(db, order.id, "printing_finished", user_id=current_user.id)
    order.time_print_finished = datetime.now(timezone.utc)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)


@router.post("/{order_id}/release_printing", response_model=OrderRead)
def release_printing_task(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])

    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )

    if order.status != OrderStatus.PRINTING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is not currently being printed",
        )

    if order.print_master_id != current_user.id and current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned printing master or admin can release this task",
        )

    order.print_master_id = None
    order.status = OrderStatus.CONFIRMED.value
    log_order_event(db, order.id, "printing_released", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)


@router.post("/{order_id}/cancel_request", response_model=OrderRead)
def request_cancel_order(order_id: int,
                         data: OrderCancelRequest,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user),
                         session = Depends(require_active_session)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    order = get_order_or_404(db, order_id)

    validate_cancel_request(order.status)

    if not data.reason or not data.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cancel reason is required",
        )

    order.cancel_requested_from_status = order.status
    order.status = OrderStatus.CANCEL_REQUESTED.value
    order.cancel_reason = data.reason.strip()
    order.cancel_requested_by_user_id = current_user.id
    order.cancel_requested_at = datetime.now(timezone.utc)
    log_order_event(db, order.id, "cancel_requested", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)

@router.post("/{order_id}/cancel_approve", response_model=OrderRead)
def approve_cancel_order(order_id: int,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user),
                         session = Depends(require_active_session)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    order = get_order_or_404(db, order_id)
    validate_cancel_approve(order.status)

    from_status = order.cancel_requested_from_status
    if from_status in {OrderStatus.NEW.value, OrderStatus.CONFIRMED.value}:
        current_model_size = (
            db.query(CatalogModelSize)
            .filter(
                CatalogModelSize.model_id == order.model_id,
                CatalogModelSize.size_id == order.size_id,
            )
            .first()
        )
        if not current_model_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current order model-size combination is invalid",
            )
        current_model_size.stock_qty += 1
    order.status = OrderStatus.CANCELED.value
    log_order_event(db, order.id, "cancel_approved", user_id=current_user.id)
    order.canceled_by_user_id = current_user.id
    if not order.cancel_reason:
        order.cancel_reason = f"Cancel approved by {current_user.username} (id: {current_user.id})"
    order.canceled_at = datetime.now(timezone.utc)
    clear_cancel_request_fields(order)
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)

@router.post("/{order_id}/cancel_reject", response_model=OrderRead)
def reject_cancel_order(order_id: int,
                        db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user),
                        session = Depends(require_active_session)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    order = get_order_or_404(db, order_id)
    if order.status != OrderStatus.CANCEL_REQUESTED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cancel can only be rejected from cancel_requested status",
        )
    if not order.cancel_requested_from_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original status is missing for cancel reject",
    )

    order.status = order.cancel_requested_from_status
    log_order_event(db, order.id, "cancel_rejected", user_id=current_user.id)
    clear_cancel_request_fields(order)
    order.cancel_reason = None
    commit_with_rollback(db)
    db.refresh(order)
    return serialize_order(order, db)


@router.delete("/all")
def delete_all_orders(
    restore_stock: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN])

    orders = db.query(Order).all()
    if not orders:
        return {
            "deleted_orders": 0,
            "deleted_events": 0,
            "restocked_items": 0,
        }

    restocked_items = 0
    if restore_stock:
        restock_allowed_statuses = {
            OrderStatus.NEW.value,
            OrderStatus.CONFIRMED.value,
            OrderStatus.PRINTING.value,
            OrderStatus.PRINTED.value,
            OrderStatus.NANESENIE.value,
            OrderStatus.NANESENIE_DONE.value,
            OrderStatus.DELIVERING.value,
            OrderStatus.CANCEL_REQUESTED.value,
        }

        for order in orders:
            if order.status not in restock_allowed_statuses:
                continue
            if order.model_id is None or order.size_id is None:
                continue

            model_size = (
                db.query(CatalogModelSize)
                .filter(
                    CatalogModelSize.model_id == order.model_id,
                    CatalogModelSize.size_id == order.size_id,
                )
                .first()
            )
            if model_size is None:
                continue
            model_size.stock_qty += 1
            restocked_items += 1

    order_ids = [order.id for order in orders]
    deleted_events = (
        db.query(OrderEvent)
        .filter(OrderEvent.order_id.in_(order_ids))
        .delete(synchronize_session=False)
    )

    for order in orders:
        db.delete(order)

    commit_with_rollback(db)

    return {
        "deleted_orders": len(order_ids),
        "deleted_events": deleted_events,
        "restocked_items": restocked_items,
    }

@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    db.delete(order)
    commit_with_rollback(db)
    return {"detail": f"Order {order_id} deleted"}
