from pydantic import BaseModel, ConfigDict


class PromoCodeCreate(BaseModel):
    code: str
    description: str | None = None


class PromoCodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    description: str | None = None
    is_active: bool


class PromoCodeUpdate(BaseModel):
    description: str | None = None
    is_active: bool | None = None
