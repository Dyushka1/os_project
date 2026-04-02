from pydantic import BaseModel

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
    
class SessionStatsResponse(BaseModel):
    session_id: int
    total_orders: int
    completed_orders: int
    avg_cycle_minutes: float
    peak_load_hour: str | None = None