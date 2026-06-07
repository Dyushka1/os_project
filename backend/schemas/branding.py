from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BrandingAssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_key: str
    file_url: str | None = None
    file_name: str | None = None
    color_value: str | None = None
    updated_at: datetime | None = None


class BrandingColorUpdate(BaseModel):
    color_value: str
