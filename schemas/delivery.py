from pydantic import BaseModel
from models.delivery import DeliveryStatus


class DeliveryCreate(BaseModel):
    order_id: int
    status: DeliveryStatus

class DeliveryRead(BaseModel):
    id: int
    order_id: int
    status: DeliveryStatus

class DeliveryUpdate(BaseModel):
    status: DeliveryStatus  
    