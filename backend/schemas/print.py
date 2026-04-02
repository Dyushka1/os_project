from pydantic import BaseModel
from models.print_job import PrintJobStatus


class PrintJobCreate(BaseModel):
    order_id: int
    status: PrintJobStatus

class PrintJobRead(BaseModel):
    id: int
    order_id: int
    status: PrintJobStatus

class PrintJobUpdate(BaseModel):
    status: PrintJobStatus