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
    print_text: str | None = None
    print_font: str | None = None
    print_side: str | None = None
    print_x: int | None = None
    print_y: int | None = None
    print_angle: float | None = None
    print_scale: int | None = None


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: int | None = None
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

    print_text: str | None = None
    print_font: str | None = None
    print_side: str | None = None
    print_x: int | None = None
    print_y: int | None = None
    print_angle: float | None = None
    print_scale: int | None = None
    
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
    print_text: str | None = None
    print_font: str | None = None
    print_side: str | None = None
    print_x: int | None = None
    print_y: int | None = None
    print_angle: float | None = None
    print_scale: int | None = None
    
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


# ==================== Master-specific schemas ====================

class PrintMasterTaskRead(BaseModel):
    """
    Task for print master (мастер печати).
    Contains order info + pre-resolved catalog names.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int  # order ID
    order_id: int | None = None  # alias for id
    order_number: int | None = None
    
    # Изделие
    model_name: str | None = None
    size_code: str | None = None
    color_name: str | None = None
    
    # Параметры печати (могут быть пусты если не установлены клиентом)
    print_side: str | None = None
    print_x: int | None = None
    print_y: int | None = None
    print_angle: float | None = None
    print_scale: int | None = None
    print_text: str | None = None
    print_font: str | None = None
    
    # Принт (из каталога)
    print_id: int | None = None
    print_name: str | None = None
    print_type: str | None = None
    print_image_url: str | None = None

    # Изображения изделия (модель спереди/сзади)
    front_image_url: str | None = None
    back_image_url: str | None = None


class NanesenieMasterTaskRead(BaseModel):
    """
    Task for nanesenie master (мастер принтов).
    Contains order info + print details + pre-resolved catalog names.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int  # order ID
    order_id: int | None = None  # alias for id
    order_number: int | None = None
    
    # Изделие
    model_name: str | None = None
    size_code: str | None = None
    color_name: str | None = None
    
    # Принт (то, что нужно нанести)
    print_id: int | None = None
    print_name: str | None = None
    print_type: str | None = None
    print_image_url: str | None = None
    print_text: str | None = None
    print_font: str | None = None
    print_side: str | None = None
    print_x: int | None = None
    print_y: int | None = None
    print_angle: float | None = None
    print_scale: int | None = None
    print_width: int | None = None
    print_height: int | None = None

    # Изображения изделия (для визуального превью у мастера)
    front_image_url: str | None = None
    back_image_url: str | None = None