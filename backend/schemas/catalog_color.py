from pydantic import BaseModel, ConfigDict

class CatalogColorCreate(BaseModel):
    name: str
    hex_code: str | None = None
    is_active: bool = True


class CatalogColorUpdate(BaseModel):
    name: str | None = None
    hex_code: str | None = None
    is_active: bool | None = None


class CatalogColorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None = None
    hex_code: str | None = None
    is_active: bool