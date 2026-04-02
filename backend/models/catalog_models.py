from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from database import Base


class CatalogModel(Base):
    __tablename__ = "catalog_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    garment_type = Column(String, nullable=True, index=True)
    color_id = Column(Integer, ForeignKey("catalog_colors.id"), nullable=False, index=True)
    front_image_url = Column(String, nullable=True)
    back_image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
