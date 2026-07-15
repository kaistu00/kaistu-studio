from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base


class Upscaler(Base):
    __tablename__ = "upscalers"

    id = Column(Integer, primary_key=True)
    model_id = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    short_desc = Column(String, nullable=False)
    usage = Column(String, nullable=False)
    size = Column(String, nullable=False)
    downloads_to = Column(String, nullable=False)
    scales = Column(String, nullable=False)
    author = Column(String, nullable=False)
    author_url = Column(String, nullable=False)
    installed = Column(Integer, default=0)
    default_scale = Column(Integer, default=4)
    runtime_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
