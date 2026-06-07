from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from auth import get_current_user, require_roles
from models.users import User, Role
from models.orders import Order, OrderStatus
from schemas.stats import (
    StatusStatsResponse,
    WorkerStatsResponse,
    QueueStatsResponse,
    SessionStatsResponse,
    StatsSummaryResponse,
    ActiveSessionSummary,
)
from database import get_db
from sqlalchemy import func
from collections import Counter
from fastapi import HTTPException, status
from models.sessions import SessionModel
from schemas.orders import OrderEventRead
from datetime import datetime, timezone
from models.order_events import OrderEvent

router = APIRouter(prefix="/stats", tags=["stats"])


def _strip_tz(dt: datetime) -> datetime:
    """Return naive UTC datetime regardless of whether the input is tz-aware."""
    if dt is None:
        return dt
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def _delta_minutes(start: datetime, end: datetime) -> float | None:
    start = _strip_tz(start)
    end = _strip_tz(end)
    if start is None or end is None:
        return None
    delta = (end - start).total_seconds() / 60
    return delta if delta > 0 else None


def _compute_avg_cycle_minutes(db: Session) -> float:
    created_rows = (
        db.query(OrderEvent.order_id, OrderEvent.created_at)
        .filter(OrderEvent.event_type == "order_created")
        .all()
    )
    issued_rows = (
        db.query(OrderEvent.order_id, OrderEvent.created_at)
        .filter(OrderEvent.event_type == "issued")
        .all()
    )
    created_map = {r.order_id: r.created_at for r in created_rows}
    durations = []
    for row in issued_rows:
        if row.order_id in created_map:
            delta = _delta_minutes(created_map[row.order_id], row.created_at)
            if delta is not None:
                durations.append(delta)
    return round(sum(durations) / len(durations), 1) if durations else 0.0


def _compute_worker_stats(db: Session, worker: User) -> WorkerStatsResponse:
    role = worker.role

    if role == Role.NANESENIE:
        start_type, finish_type = "nanesenie_started", "nanesenie_finished"
    elif role == Role.PRINT:
        start_type, finish_type = "printing_started", "printing_finished"
    elif role == Role.ISSUE:
        start_type, finish_type = "delivery_started", "issued"
    elif role == Role.RECEPTION:
        start_type, finish_type = "order_confirmed", "order_confirmed"
    else:
        return WorkerStatsResponse(
            user_id=worker.id,
            username=worker.username,
            role=role.value,
            count_orders=0,
        )

    start_events = (
        db.query(OrderEvent)
        .filter(OrderEvent.user_id == worker.id, OrderEvent.event_type == start_type)
        .all()
    )

    if role == Role.RECEPTION:
        count_orders = len(start_events)
        return WorkerStatsResponse(
            user_id=worker.id,
            username=worker.username,
            role=role.value,
            count_orders=count_orders,
            items_per_hour=0.0,
            avg_operation_minutes=0.0,
        )

    finish_events = (
        db.query(OrderEvent)
        .filter(OrderEvent.user_id == worker.id, OrderEvent.event_type == finish_type)
        .all()
    )

    starts_by_order = {e.order_id: e.created_at for e in start_events}
    durations: list[float] = []
    for fe in finish_events:
        if fe.order_id in starts_by_order:
            delta = _delta_minutes(starts_by_order[fe.order_id], fe.created_at)
            if delta is not None:
                durations.append(delta)

    count_orders = len(durations)
    avg_op = round(sum(durations) / len(durations), 1) if durations else 0.0

    # items_per_hour: orders completed / active span in hours
    all_times = [_strip_tz(e.created_at) for e in start_events + finish_events if e.created_at]
    if len(all_times) >= 2:
        span_hours = (max(all_times) - min(all_times)).total_seconds() / 3600
        items_per_hour = round(count_orders / span_hours, 1) if span_hours > 0 else 0.0
    else:
        items_per_hour = 0.0

    return WorkerStatsResponse(
        user_id=worker.id,
        username=worker.username,
        role=role.value,
        count_orders=count_orders,
        items_per_hour=items_per_hour,
        avg_operation_minutes=avg_op,
    )


@router.get("/summary", response_model=StatsSummaryResponse)
def get_summary_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])

    status_rows = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    status_map = {status_name: count for status_name, count in status_rows}
    for status_enum in OrderStatus:
        if status_enum.value not in status_map:
            status_map[status_enum.value] = 0
    status_stats = StatusStatsResponse(**status_map)

    queue_print = db.query(func.count(Order.id)).filter(
        Order.status == OrderStatus.CONFIRMED.value
    ).scalar() or 0
    queue_nanesenie = db.query(func.count(Order.id)).filter(
        Order.status == OrderStatus.PRINTED.value
    ).scalar() or 0
    queue_issue = db.query(func.count(Order.id)).filter(
        Order.status == OrderStatus.NANESENIE_DONE.value
    ).scalar() or 0
    queue_stats = QueueStatsResponse(
        queue_print=queue_print,
        queue_nanesenie=queue_nanesenie,
        queue_issue=queue_issue,
    )

    total_orders = db.query(func.count(Order.id)).scalar() or 0
    completed_orders = db.query(func.count(Order.id)).filter(Order.status == OrderStatus.ISSUED.value).scalar() or 0
    avg_cycle_minutes = _compute_avg_cycle_minutes(db)

    active_session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
    active_session_summary = None
    if active_session is not None:
        active_session_summary = ActiveSessionSummary(
            id=active_session.id,
            has_nanesenie=active_session.has_nanesenie,
            started_at=active_session.started_at,
            started_by_user_id=active_session.started_by_user_id,
        )

    return StatsSummaryResponse(
        total_orders=total_orders,
        completed_orders=completed_orders,
        avg_cycle_minutes=avg_cycle_minutes,
        statuses=status_stats,
        queues=queue_stats,
        active_session=active_session_summary,
    )

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

    worker_roles = [Role.PRINT, Role.NANESENIE, Role.ISSUE, Role.RECEPTION]
    workers = db.query(User).filter(User.role.in_(worker_roles)).all()
    return [_compute_worker_stats(db, w) for w in workers]


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
            delta = _delta_minutes(order.time_print_started, order.time_issued)
            if delta is not None:
                cycle_minutes.append(delta)

        if order.time_confirmed:
            hours.append(_strip_tz(order.time_confirmed).strftime("%H"))

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
