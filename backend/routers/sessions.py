from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from auth import get_current_user, require_roles
from models.users import User, Role
from models.sessions import SessionModel
from schemas.sessions import SessionRead, SessionStartRequest, SessionRestartRequest
from database import get_db
from datetime import datetime, timezone
from models.orders import Order, OrderStatus
from models.catalog_model_sizes import CatalogModelSize


router = APIRouter(prefix="/sessions", tags=["sessions"])


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc

@router.post("/start", response_model=SessionRead)
def start_session(
    data: SessionStartRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(current_user, [Role.ADMIN])
    session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
    if session:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session already active")
    start_data = data or SessionStartRequest()
    new_session = SessionModel(
        is_active=True,
        started_at=datetime.now(timezone.utc),
        started_by_user_id=current_user.id,
        has_nanesenie=start_data.has_nanesenie,
    )
    db.add(new_session)
    commit_with_rollback(db)
    db.refresh(new_session)
    return new_session


def restock_orders_if_needed(db: Session, orders: list[Order]) -> int:
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

    restocked_items = 0
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

    return restocked_items


UNFINISHED_STATUSES = {
    OrderStatus.NEW.value,
    OrderStatus.CONFIRMED.value,
    OrderStatus.PRINTING.value,
    OrderStatus.PRINTED.value,
    OrderStatus.NANESENIE.value,
    OrderStatus.NANESENIE_DONE.value,
    OrderStatus.DELIVERING.value,
    OrderStatus.CANCEL_REQUESTED.value,
}


@router.post("/restart")
def restart_session(
    data: SessionRestartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(current_user, [Role.ADMIN])

    canceled_orders = 0
    restocked_items = 0

    active_session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
    if active_session is not None:
        session_orders = db.query(Order).filter(Order.session_id == active_session.id).all()
        unfinished = [o for o in session_orders if o.status in UNFINISHED_STATUSES]

        restocked_items = restock_orders_if_needed(db, unfinished) if data.restore_stock else 0

        for order in unfinished:
            order.status = OrderStatus.CANCELED.value
            order.cancel_reason = "Смена перезапущена"
            order.canceled_at = datetime.now(timezone.utc)
            order.canceled_by_user_id = current_user.id
            canceled_orders += 1

        active_session.is_active = False
        active_session.stopped_at = datetime.now(timezone.utc)
        active_session.stopped_by_user_id = current_user.id

    new_session = SessionModel(
        is_active=True,
        started_at=datetime.now(timezone.utc),
        started_by_user_id=current_user.id,
        has_nanesenie=data.has_nanesenie,
    )
    db.add(new_session)
    commit_with_rollback(db)
    db.refresh(new_session)

    return {
        "session": SessionRead.model_validate(new_session),
        "canceled_orders": canceled_orders,
        "restocked_items": restocked_items,
    }


@router.post("/continue", response_model=SessionRead)
def continue_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])

    active_session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
    if active_session is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session already active")

    last_stopped_session = (
        db.query(SessionModel)
        .filter(SessionModel.is_active == False)
        .order_by(SessionModel.stopped_at.desc().nullslast(), SessionModel.id.desc())
        .first()
    )
    if last_stopped_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No stopped session to continue")

    last_stopped_session.is_active = True
    last_stopped_session.stopped_at = None
    last_stopped_session.stopped_by_user_id = None
    commit_with_rollback(db)
    db.refresh(last_stopped_session)
    return last_stopped_session


@router.get("/active", response_model=SessionRead)
def get_active_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION, Role.PRINT, Role.NANESENIE, Role.ISSUE, Role.USER])
    session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active session")
    return session

@router.post("/stop", response_model=SessionRead)
def stop_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])
    session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active session to stop")
    session.is_active = False
    session.stopped_at = datetime.now(timezone.utc)
    session.stopped_by_user_id = current_user.id
    commit_with_rollback(db)
    db.refresh(session)
    return session


    