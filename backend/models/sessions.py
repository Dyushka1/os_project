from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey
from database import Base
from datetime import datetime, timezone


class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    is_active = Column(Boolean, default=False, index=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    stopped_at = Column(DateTime, nullable=True)
    started_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    stopped_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    has_nanesenie = Column(Boolean, default=True)
