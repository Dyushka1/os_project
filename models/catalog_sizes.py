from sqlalchemy import Column, Integer, String, Boolean
from database import Base


class CatalogSize(Base):
    __tablename__ = "catalog_sizes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    sort_order = Column(Integer, default=0, index=True)
    is_active = Column(Boolean, default=True, index=True)
