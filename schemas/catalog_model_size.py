from pydantic import BaseModel, ConfigDict


class CatalogModelSizeCreate(BaseModel):
    model_id: int
    size_id: int
    stock_qty: int = 0
    is_active: bool = True


class CatalogModelSizeUpdate(BaseModel):
    model_id: int | None = None
    size_id: int | None = None
    stock_qty: int | None = None
    is_active: bool | None = None


class CatalogModelSizeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    model_id: int
    size_id: int
    stock_qty: int
    is_active: bool
