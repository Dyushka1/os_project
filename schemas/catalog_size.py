from pydantic import BaseModel, ConfigDict


class CatalogSizeCreate(BaseModel):
    code: str
    sort_order: int = 0
    is_active: bool = True


class CatalogSizeUpdate(BaseModel):
    code: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CatalogSizeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    sort_order: int
    is_active: bool
