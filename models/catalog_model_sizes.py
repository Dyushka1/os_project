from sqlalchemy import Column, Integer, Boolean, ForeignKey, UniqueConstraint
from database import Base


class CatalogModelSize(Base):
    __tablename__ = "catalog_model_sizes"
    __table_args__ = (
        UniqueConstraint("model_id", "size_id", name="uq_catalog_model_sizes_model_size"),
    )

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("catalog_models.id"), nullable=False, index=True)
    size_id = Column(Integer, ForeignKey("catalog_sizes.id"), nullable=False, index=True)
    stock_qty = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, index=True)
