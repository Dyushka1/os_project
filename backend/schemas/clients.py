from pydantic import BaseModel, ConfigDict


class ClientCreate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str | None = None
    email: str | None = None


class ClientUpdate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None