from pydantic import BaseModel, ConfigDict


class CatalogPrintCreate(BaseModel):
    name: str
    print_type: str = "regular"
    image_url: str | None = None
    stock_qty: int | None = None
    is_active: bool = True


class CatalogPrintUpdate(BaseModel):
    name: str | None = None
    print_type: str | None = None
    image_url: str | None = None
    stock_qty: int | None = None
    is_active: bool | None = None


class CatalogPrintRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    print_type: str
    image_url: str | None = None
    stock_qty: int | None = None
    is_active: bool
