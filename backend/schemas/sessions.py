from pydantic import BaseModel, ConfigDict
from datetime import datetime


class SessionStartRequest(BaseModel):
    has_nanesenie: bool = True


class SessionRestartRequest(BaseModel):
    has_nanesenie: bool = True
    restore_stock: bool = False

class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    is_active: bool
    started_at: datetime
    stopped_at: datetime | None = None
    started_by_user_id: int | None = None
    stopped_by_user_id: int | None = None
    has_nanesenie: bool
    