from pydantic import BaseModel, ConfigDict
from models.orders import OrderStatus
from schemas.clients import ClientCreate, ClientRead
from datetime import datetime

class OrderCreate(BaseModel):
    client_id: int | None = None
    client: ClientCreate | None = None
    color_id: int | None = None
    model_id: int
    size_id: int
    print_id: int | None = None
    promo_code: str | None = None
    notify_method: str | None = None  # e.g. "sms", "email"
    notify_contact: str | None = None  # e.g. phone number or email address


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int | None = None
    client: ClientRead | None = None
    status: OrderStatus
    
    print_master_id: int | None = None
    nanesenie_master_id: int | None = None
    issue_master_id: int | None = None
    
    cancel_reason: str | None = None
    cancel_requested_by_user_id: int | None = None
    cancel_requested_at: datetime | None = None
    canceled_by_user_id: int | None = None
    canceled_at: datetime | None = None
    
    time_confirmed: datetime | None = None
    time_print_started: datetime | None = None
    time_print_finished: datetime | None = None
    time_issued: datetime | None = None
    
    promo_code: str | None = None
    notify_method: str | None = None
    notify_contact: str | None = None
    
    color_id: int | None = None
    model_id: int | None = None
    size_id: int | None = None
    print_id: int | None = None
    
    session_id: int | None = None

class OrderUpdate(BaseModel):
    status: OrderStatus | None = None

class OrderCatalogUpdate(BaseModel):
    color_id: int | None = None
    model_id: int | None = None
    size_id: int | None = None
    print_id: int | None = None
    
class OrderCancelRequest(BaseModel):
    reason: str


class OrderCancelDecision(BaseModel):
    approve: bool = True
    
class OrderEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    event_type: str
    created_at: datetime
    user_id: int | None = None