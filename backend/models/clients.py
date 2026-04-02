from sqlalchemy import Column, Integer, String
from database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    phone = Column(String, index=True, nullable=True)
    email = Column(String, index=True, nullable=True)