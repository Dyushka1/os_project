from sqlalchemy import Column, Integer, String, Boolean
from database import Base


class CatalogPrint(Base):
    __tablename__ = "catalog_prints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    print_type = Column(String, index=True, nullable=False, default="regular")
    image_url = Column(String, nullable=True)
    stock_qty = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
