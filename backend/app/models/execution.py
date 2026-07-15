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
    output_path = Column(String, nullable=False)
    output_format = Column(String, default="png")
    scale = Column(Integer, default=2)
    mode = Column(String, default="upscale")
    target_width = Column(Integer, nullable=True)
    target_height = Column(Integer, nullable=True)
    status = Column(String, default="pending")
    progress = Column(Integer, default=0)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)
    params_json = Column(Text, default="{}")
    pid = Column(Integer, nullable=True)
    queued_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "model_id": self.model_id,
            "model_name": self.model_name,
            "input_file": self.input_file,
            "input_width": self.input_width,
            "input_height": self.input_height,
            "file_size": self.file_size,
            "output_path": self.output_path,
            "output_format": self.output_format,
            "scale": self.scale,
            "mode": self.mode,
            "target_width": self.target_width,
            "target_height": self.target_height,
            "status": self.status,
            "progress": self.progress,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
            "params_json": self.params_json,
        }
