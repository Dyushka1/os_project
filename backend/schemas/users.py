from pydantic import BaseModel
from models.users import Role

class UserCreate(BaseModel):
    username: str
    password: str
    role: Role = Role.RECEPTION

class UserRead(BaseModel):
    id: int
    username: str
    role: Role

class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    role: Role | None = None
    