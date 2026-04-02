from pydantic import BaseModel, ConfigDict


class CatalogModelCreate(BaseModel):
    name: str
    garment_type: str | None = None
    color_id: int
    front_image_url: str | None = None
    back_image_url: str | None = None
    is_active: bool = True


class CatalogModelUpdate(BaseModel):
    name: str | None = None
    garment_type: str | None = None
    color_id: int | None = None
    front_image_url: str | None = None
    back_image_url: str | None = None
    is_active: bool | None = None


class CatalogModelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    garment_type: str | None = None
    color_id: int
    front_image_url: str | None = None
    back_image_url: str | None = None
    is_active: bool
