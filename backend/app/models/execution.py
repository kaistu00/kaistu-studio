import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, Text

from app.database import Base


class Execution(Base):
    __tablename__ = "executions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    model_id = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    input_file = Column(String, nullable=False)
    input_width = Column(Integer, default=0)
    input_height = Column(Integer, default=0)
    file_size = Column(String, default="")
    output_format = Column(String, default="png")
    scale = Column(Integer, default=2)
    status = Column(String, default="pending")
    progress = Column(Integer, default=0)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    output_path = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    params_json = Column(Text, default="{}")

    def to_dict(self):
        return {
            "id": self.id,
            "model_id": self.model_id,
            "model_name": self.model_name,
            "input_file": self.input_file,
            "input_width": self.input_width,
            "input_height": self.input_height,
            "file_size": self.file_size,
            "output_format": self.output_format,
            "scale": self.scale,
            "status": self.status,
            "progress": self.progress,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "output_path": self.output_path,
            "error_message": self.error_message,
            "params_json": self.params_json,
        }
