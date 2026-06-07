import re
from pydantic import BaseModel, ConfigDict, field_validator


PHONE_REGEX = re.compile(r"^\+?\d{10,15}$")


class ClientCreate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is None:
            return value
        phone_value = value.strip()
        if not PHONE_REGEX.fullmatch(phone_value):
            raise ValueError("Phone must contain only digits (optional leading +) and be 10-15 chars long")
        return phone_value


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

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is None:
            return value
        phone_value = value.strip()
        if not PHONE_REGEX.fullmatch(phone_value):
            raise ValueError("Phone must contain only digits (optional leading +) and be 10-15 chars long")
        return phone_value