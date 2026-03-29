from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from auth import get_current_user, require_active_session, require_roles
from models.users import User, Role
from schemas.orders import OrderCreate, OrderRead, OrderUpdate, OrderCatalogUpdate
from schemas.clients import ClientCreate
from database import get_db
from models.clients import Client
from models.orders import Order, OrderStatus, validate_status_transition
from models.catalog_model_sizes import CatalogModelSize
from models.catalog_models import CatalogModel
from models.catalog_sizes import CatalogSize
from models.catalog_prints import CatalogPrint
from models.catalog_colors import CatalogColors
from datetime import datetime, timezone
from models.order_events import OrderEvent
router = APIRouter(prefix="/orders", tags=["orders"])

TEXT_PRINT_TYPES = {"text", "custom_text", "own_text", "own-text"}
ALLOWED_PRINT_SIDES = {"front", "back", "left", "right"}


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


def validate_print_payload(
    print_type: str | None,
    print_text: str | None,
    print_font: str | None,
    print_side: str | None,
    print_x: int | None,
    print_y: int | None,
    print_angle: float | None,
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
            detail="print_side must be one of: front, back, left, right",
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
    
    
def get_or_create_client(db: Session, client_data: ClientCreate) -> int:
    client = db.query(Client).filter_by(phone=client_data.phone).first()
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
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION, Role.ISSUE])

    query = db.query(Order).outerjoin(Client, Client.id == Order.client_id)

    if q:
        q_value = q.strip()
        if q_value:
            filters = []
            if q_value.isdigit():
                filters.append(Order.id == int(q_value))

            like_value = f"%{q_value}%"
            filters.append(Client.name.ilike(like_value))
            filters.append(Client.phone.ilike(like_value))
            filters.append(Order.promo_code.ilike(like_value))

            query = query.filter(or_(*filters))

    if order_status is not None:
        query = query.filter(Order.status == order_status.value)

    return query.order_by(Order.id.desc()).limit(limit).all()
        


@router.get("/", response_model=list[OrderRead])
def list_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN, Role.USER])
    orders = db.query(Order).all()
    return orders

@router.get("/{order_id}" , response_model=OrderRead)
def get_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN, Role.USER])
    order = db.query(Order).filter(Order.id== order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    return order

@router.post("/", response_model=OrderRead)
def create_order(order: OrderCreate,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user),
                 session = Depends(require_active_session)
                 ):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    
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
    validate_print_payload(
        print_type=selected_print_type,
        print_text=order.print_text,
        print_font=order.print_font,
        print_side=order.print_side,
        print_x=order.print_x,
        print_y=order.print_y,
        print_angle=order.print_angle,
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
                      print_angle=order.print_angle,)
    model_and_size.stock_qty -= 1
    db.add(new_order)
    db.flush()
    log_order_event(db, new_order.id, "order_created", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(new_order)
    return new_order


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
    return order

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

    validate_print_payload(
        print_type=selected_print.print_type if selected_print is not None else None,
        print_text=new_print_text,
        print_font=new_print_font,
        print_side=new_print_side,
        print_x=new_print_x,
        print_y=new_print_y,
        print_angle=new_print_angle,
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

    log_order_event(db, order.id, "order_catalog_updated", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(order)
    return order
    
    
                        
                            
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
    return order
    

@router.post("/next/print", response_model=OrderRead)
def get_next_print_order(
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have an active print order",
            )

    order = (
        db.query(Order)
        .filter(
            Order.print_master_id.is_(None),
            Order.status == OrderStatus.CONFIRMED.value,
        )
        .order_by(Order.id.asc())
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Print queue is empty",
        )

    order.print_master_id = current_user.id
    order.status = OrderStatus.PRINTING.value
    log_order_event(db, order.id, "print_started", user_id=current_user.id)
    order.time_print_started = datetime.now(timezone.utc)
    commit_with_rollback(db)
    db.refresh(order)
    return order


@router.get("/queue/print", response_model=list[OrderRead])
def get_print_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.PRINT, Role.RECEPTION])

    queue = (
        db.query(Order)
        .filter(
            Order.print_master_id.is_(None),
            Order.status == OrderStatus.CONFIRMED.value,
        )
        .order_by(Order.id.asc())
        .all()
    )
    return queue

@router.post("/{order_id}/finish_print", response_model=OrderRead)
def finish_print(
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
    
    if order.print_master_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to print this order",
        )
        
    if current_user.role != Role.ADMIN and order.print_master_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned print master or admin can finish this order",
        )
    
    order.status = OrderStatus.PRINTED.value
    log_order_event(db, order.id, "print_finished", user_id=current_user.id)
    order.time_print_finished = datetime.now(timezone.utc)
    commit_with_rollback(db)
    db.refresh(order)
    return order

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
    
    if order.status != OrderStatus.NANESENIE_DONE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must finish nanesenie before delivery",
        )
    
    order.status = OrderStatus.DELIVERING.value
    log_order_event(db, order.id, "delivery_started", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(order)
    return order

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
    return order

@router.get("/queue/nanesenie", response_model=list[OrderRead])
def get_nanesenie_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.NANESENIE, Role.RECEPTION])
    queue = (
        db.query(Order)
        .filter(
            Order.nanesenie_master_id.is_(None),
            Order.status == OrderStatus.PRINTED.value,
        )
        .order_by(Order.id.asc())
        .all()
    )
    return queue

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

    if order.nanesenie_master_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order {order_id} is already taken for nanesenie",
        )

    if order.status != OrderStatus.PRINTED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must be printed before nanesenie",
        )

    order.nanesenie_master_id = current_user.id
    order.status = OrderStatus.NANESENIE.value
    log_order_event(db, order.id, "nanesenie_started", user_id=current_user.id)
    commit_with_rollback(db)
    db.refresh(order)
    return order

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
    return order

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
    return orders


@router.post("/next/nanesenie", response_model=OrderRead)
def get_next_nanesenie_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN, Role.NANESENIE])

    order = (
        db.query(Order)
        .filter(
            Order.nanesenie_master_id.is_(None),
            Order.status == OrderStatus.PRINTED.value,
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
    return order

@router.post("/{order_id}/cancel_request", response_model=OrderRead)
def request_cancel_order(order_id: int,
                         db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user),
                        session = Depends(require_active_session)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
        
    if order.status in [OrderStatus.ISSUED.value, OrderStatus.CANCELED.value, OrderStatus.CANCEL_REQUESTED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot request cancel for order in status {order.status}",
        )

    if order.status in [OrderStatus.NEW.value, OrderStatus.CONFIRMED.value, OrderStatus.PRINTING.value, OrderStatus.PRINTED.value, OrderStatus.NANESENIE.value, OrderStatus.NANESENIE_DONE.value, OrderStatus.DELIVERING.value]:
        order.cancel_requested_from_status = order.status
        order.status = OrderStatus.CANCEL_REQUESTED.value
        log_order_event(db, order.id, "cancel_requested", user_id=current_user.id)
        order.cancel_requested_by_user_id = current_user.id
        order.cancel_requested_at = datetime.now(timezone.utc)
        commit_with_rollback(db)
        db.refresh(order)
        return order
    raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot request cancel for order in status {order.status}",
        )

@router.post("/{order_id}/cancel_approve", response_model=OrderRead)
def approve_cancel_order(order_id: int,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user),
                         session = Depends(require_active_session)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    if order.status != OrderStatus.CANCEL_REQUESTED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve cancel for order in status {order.status}",
        )
    order.status = OrderStatus.CANCELED.value
    log_order_event(db, order.id, "cancel_approved", user_id=current_user.id)
    order.canceled_by_user_id = current_user.id
    order.cancel_reason = f"Cancel approved by {current_user.username} (id: {current_user.id})"
    order.canceled_at = datetime.now(timezone.utc)
    order.cancel_requested_from_status = None
    order.cancel_requested_at = None
    order.cancel_requested_by_user_id = None
    commit_with_rollback(db)
    db.refresh(order)
    return order    

@router.post("/{order_id}/cancel_reject", response_model=OrderRead)
def reject_cancel_order(order_id: int,
                        db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user),
                        session = Depends(require_active_session)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found",
        )
    if order.status != OrderStatus.CANCEL_REQUESTED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject cancel for order in status {order.status}",
        )
    if not order.cancel_requested_from_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original status is missing for cancel reject",
    )

    order.status = order.cancel_requested_from_status
    log_order_event(db, order.id, "cancel_rejected", user_id=current_user.id)
    order.cancel_requested_from_status = None
    order.cancel_requested_at = None
    order.cancel_requested_by_user_id = None
    order.cancel_reason = None
    commit_with_rollback(db)
    db.refresh(order)
    return order

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

