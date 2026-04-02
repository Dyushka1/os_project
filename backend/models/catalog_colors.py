from sqlalchemy import Column, Integer, String, Boolean
from database import Base

class CatalogColors(Base):
    __tablename__ = "catalog_colors"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    hex_code = Column(String, index=True)
    is_active = Column(Boolean, default=True, index=True)