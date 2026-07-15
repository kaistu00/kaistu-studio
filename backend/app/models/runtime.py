from sqlalchemy import Column, Integer, String, Text

from app.database import Base


class Runtime(Base):
    __tablename__ = "runtimes"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    version = Column(String, nullable=False)
    platforms_json = Column(Text, nullable=False)  # JSON: {"windows": {"url": "...", "binary": "..."}, "ubuntu": ..., "macos": ...}

    def platform_info(self, os_name: str) -> dict | None:
        import json
        data = json.loads(self.platforms_json)
        return data.get(os_name)

    def to_dict(self):
        import json
        return {
            "name": self.name,
            "version": self.version,
            "platforms": json.loads(self.platforms_json),
        }
