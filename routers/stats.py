from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from auth import get_current_user, require_roles
from models.users import User, Role
from models.orders import Order, OrderStatus
from schemas.stats import StatusStatsResponse, WorkerStatsResponse, QueueStatsResponse, SessionStatsResponse
from database import get_db
from sqlalchemy import func
from collections import Counter
from fastapi import HTTPException, status
from models.sessions import SessionModel
from schemas.orders import OrderEventRead
from datetime import datetime, timezone
from models.order_events import OrderEvent

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/statuses", response_model=StatusStatsResponse)
def get_status_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])
    
    results = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    stats = {status: count for status, count in results}
    for status_enum in OrderStatus:
        if status_enum.value not in stats:
            stats[status_enum.value] = 0
    
    return StatusStatsResponse(**stats)


@router.get("/queues", response_model=QueueStatsResponse)
def get_queue_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])

    queue_print = db.query(func.count(Order.id)).filter(
        Order.status == OrderStatus.CONFIRMED.value
    ).scalar()

    queue_nanesenie = db.query(func.count(Order.id)).filter(
        Order.status == OrderStatus.PRINTED.value
    ).scalar()

    queue_issue = db.query(func.count(Order.id)).filter(
        Order.status == OrderStatus.NANESENIE_DONE.value
    ).scalar()

    return QueueStatsResponse(
        queue_print=queue_print or 0,
        queue_nanesenie=queue_nanesenie or 0,
        queue_issue=queue_issue or 0,
    )


@router.get("/workers", response_model=list[WorkerStatsResponse])
def get_workers_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])

    worker_roles = [Role.PRINT, Role.NANESENIE, Role.ISSUE]
    workers = db.query(User).filter(User.role.in_(worker_roles)).all()
    result: list[WorkerStatsResponse] = []

    for worker in workers:
        if worker.role == Role.PRINT:
            count_orders = db.query(func.count(Order.id)).filter(
                Order.print_master_id == worker.id
            ).scalar() or 0
        elif worker.role == Role.NANESENIE:
            count_orders = db.query(func.count(Order.id)).filter(
                Order.nanesenie_master_id == worker.id
            ).scalar() or 0
        else:
            count_orders = db.query(func.count(Order.id)).filter(
                Order.issue_master_id == worker.id
            ).scalar() or 0

        result.append(
            WorkerStatsResponse(
                user_id=worker.id,
                username=worker.username,
                role=worker.role.value,
                count_orders=count_orders,
            )
        )

    return result


@router.get("/session/{session_id}", response_model=SessionStatsResponse)
def get_session_stats(session_id: int,
                      current_user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")  
    orders = db.query(Order).filter(Order.session_id == session_id).all()
    total_orders = len(orders)
    completed_orders = sum(1 for order in orders if order.status == OrderStatus.ISSUED.value)
    
    cycle_minutes: list[float] = []
    hours: list[str] = []
    
    for order in orders:
        if order.time_print_started and order.time_issued:
            cycle_time = (order.time_issued - order.time_print_started).total_seconds() / 60
            cycle_minutes.append(cycle_time)
            
        if order.time_confirmed:
            hours.append(order.time_confirmed.strftime("%H"))

    avg_cycle_minutes = round(sum(cycle_minutes) / len(cycle_minutes), 2) if cycle_minutes else 0.0
    peak_load_hour = f"{Counter(hours).most_common(1)[0][0]}:00" if hours else None

    return SessionStatsResponse(
        session_id=session_id,
        total_orders=total_orders,
        completed_orders=completed_orders,
        avg_cycle_minutes=avg_cycle_minutes,
        peak_load_hour=peak_load_hour
    )

@router.get("/orders/{order_id}/events", response_model=list[OrderEventRead])
def get_order_events(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])
    events = db.query(OrderEvent).filter(OrderEvent.order_id == order_id).order_by(OrderEvent.created_at.asc()).all()
    return events