from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from database import Base
import enum
from fastapi import HTTPException
from datetime import datetime
class OrderStatus(enum.Enum):
    NEW = "new"          # Новый заказ
    CONFIRMED = "confirmed"  # Подтверждён
    PRINTING = "printing"    # Печатается
    PRINTED = "printed"      # Напечатан
    NANESENIE = "nanesenie"  # На нанесении
    NANESENIE_DONE = "nanesenie_done"  # Нанесение завершено
    DELIVERING = "delivering" # Доставляется
    ISSUED = "issued"
    CANCEL_REQUESTED = "cancel_requested"
    CANCELED = "canceled"

STATUS_TRANSITIONS = {
    OrderStatus.NEW.value: [OrderStatus.CONFIRMED.value, OrderStatus.CANCEL_REQUESTED.value],
    OrderStatus.CONFIRMED.value: [OrderStatus.PRINTING.value, OrderStatus.CANCEL_REQUESTED.value],
    OrderStatus.PRINTING.value: [OrderStatus.PRINTED.value, OrderStatus.CANCEL_REQUESTED.value],
    OrderStatus.PRINTED.value: [OrderStatus.NANESENIE.value, OrderStatus.CANCEL_REQUESTED.value],
    OrderStatus.NANESENIE.value: [OrderStatus.NANESENIE_DONE.value, OrderStatus.CANCEL_REQUESTED.value],
    OrderStatus.NANESENIE_DONE.value: [OrderStatus.DELIVERING.value, OrderStatus.CANCEL_REQUESTED.value],
    OrderStatus.DELIVERING.value: [OrderStatus.ISSUED.value, OrderStatus.CANCEL_REQUESTED.value],
    OrderStatus.ISSUED.value: [],
    OrderStatus.CANCEL_REQUESTED.value: [OrderStatus.CANCELED.value],
    OrderStatus.CANCELED.value: [],
}

CANCEL_REQUEST_ALLOWED_STATUSES = {
    OrderStatus.NEW.value,
    OrderStatus.CONFIRMED.value,
    OrderStatus.PRINTING.value,
    OrderStatus.PRINTED.value,
    OrderStatus.NANESENIE.value,
    OrderStatus.NANESENIE_DONE.value,
    OrderStatus.DELIVERING.value,
}

def validate_status_transition(current_status: str, new_status: str):
    allowed = STATUS_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot change status from {current_status} to {new_status}",
        )


def validate_cancel_request(current_status: str):
    if current_status not in CANCEL_REQUEST_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot request cancel from status {current_status}",
        )


def validate_cancel_approve(current_status: str):
    if current_status != OrderStatus.CANCEL_REQUESTED.value:
        raise HTTPException(
            status_code=400,
            detail="Cancel can only be approved from cancel_requested status",
        )
        
class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    status = Column(String, index=True)
    
    print_master_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    nanesenie_master_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    issue_master_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    color_id = Column(Integer, ForeignKey("catalog_colors.id"), nullable=True, index=True)
    model_id = Column(Integer, ForeignKey("catalog_models.id"), nullable=True, index=True)
    size_id = Column(Integer, ForeignKey("catalog_sizes.id"), nullable=True, index=True)
    print_id = Column(Integer, ForeignKey("catalog_prints.id"), nullable=True, index=True)

    cancel_reason = Column(String, nullable=True)
    cancel_requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    cancel_requested_at = Column(DateTime, nullable=True)
    canceled_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    canceled_at = Column(DateTime, nullable=True)
    cancel_requested_from_status = Column(String, nullable=True)

    time_confirmed = Column(DateTime, nullable=True)
    time_print_started = Column(DateTime, nullable=True)
    time_print_finished = Column(DateTime, nullable=True)
    time_issued = Column(DateTime, nullable=True)
    
    promo_code = Column(String, nullable=True, index=True)
    notify_method = Column(String, nullable=True)
    notify_contact = Column(String, nullable=True)
    
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True, index=True)