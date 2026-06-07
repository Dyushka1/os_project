from pydantic import BaseModel, Field
from models.users import Role

class UserCreate(BaseModel):
    username: str
    password: str = Field(min_length=8)
    role: Role = Role.RECEPTION

class UserRead(BaseModel):
    id: int
    username: str
    role: Role

class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = Field(default=None, min_length=8)
    role: Role | None = None
    