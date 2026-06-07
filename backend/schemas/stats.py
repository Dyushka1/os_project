from pydantic import BaseModel
from datetime import datetime

class StatusStatsResponse(BaseModel):
    new: int = 0
    confirmed: int = 0
    printing: int = 0
    printed: int = 0
    nanesenie: int = 0
    nanesenie_done: int = 0
    delivering: int = 0
    issued: int = 0
    cancel_requested: int = 0
    canceled: int = 0

class QueueStatsResponse(BaseModel):
    queue_print: int
    queue_nanesenie: int
    queue_issue: int

class WorkerStatsResponse(BaseModel):
    user_id: int
    username: str
    role: str
    count_orders: int
    items_per_hour: float = 0.0
    avg_operation_minutes: float = 0.0

class SessionStatsResponse(BaseModel):
    session_id: int
    total_orders: int
    completed_orders: int
    avg_cycle_minutes: float
    peak_load_hour: str | None = None


class ActiveSessionSummary(BaseModel):
    id: int
    has_nanesenie: bool
    started_at: datetime
    started_by_user_id: int | None = None


class StatsSummaryResponse(BaseModel):
    total_orders: int
    completed_orders: int
    avg_cycle_minutes: float = 0.0
    statuses: StatusStatsResponse
    queues: QueueStatsResponse
    active_session: ActiveSessionSummary | None = None
