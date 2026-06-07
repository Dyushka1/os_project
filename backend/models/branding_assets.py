from sqlalchemy import Column, DateTime, Integer, String, func

from database import Base


class BrandingAsset(Base):
    __tablename__ = "branding_assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_key = Column(String, unique=True, index=True, nullable=False)
    file_url = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    color_value = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
