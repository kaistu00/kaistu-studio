import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.execution import Execution

router = APIRouter(prefix="/executions", tags=["executions"])


@router.get("")
def list_executions(db: Session = Depends(get_db)):
    rows = db.query(Execution).order_by(Execution.started_at.desc()).limit(50).all()
    return [r.to_dict() for r in rows]


@router.get("/stats")
def execution_stats(db: Session = Depends(get_db)):
    total = db.query(Execution).count()
    completed = db.query(Execution).filter(Execution.status == "completed").count()
    running = db.query(Execution).filter(Execution.status.in_(["pending", "running"])).count()
    failed = db.query(Execution).filter(Execution.status == "failed").count()
    return {"total": total, "completed": completed, "running": running, "failed": failed}


@router.get("/{exec_id}")
def get_execution(exec_id: str, db: Session = Depends(get_db)):
    row = db.query(Execution).filter(Execution.id == exec_id).first()
    if not row:
        raise HTTPException(404, "Execution not found")
    return row.to_dict()


@router.post("/start")
def start_execution(payload: dict, db: Session = Depends(get_db)):
    execution = Execution(
        id=payload.get("id", str(uuid.uuid4())),
        model_id=payload.get("model_id", ""),
        model_name=payload.get("model_name", ""),
        input_file=payload.get("input_file", ""),
        input_width=payload.get("input_width", 0),
        input_height=payload.get("input_height", 0),
        file_size=payload.get("file_size", ""),
        output_format=payload.get("output_format", "png"),
        scale=payload.get("scale", 2),
        status="pending",
        progress=0,
        params_json=json.dumps(payload.get("params", {})),
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    return execution.to_dict()


@router.post("/{exec_id}/progress")
def update_progress(exec_id: str, payload: dict, db: Session = Depends(get_db)):
    row = db.query(Execution).filter(Execution.id == exec_id).first()
    if not row:
        raise HTTPException(404, "Execution not found")
    if "status" in payload:
        row.status = payload["status"]
        if payload["status"] in ("completed", "failed"):
            row.completed_at = datetime.now(timezone.utc)
            if payload["status"] == "failed":
                row.error_message = payload.get("error_message", "")
    if "progress" in payload:
        row.progress = payload["progress"]
    if "output_path" in payload:
        row.output_path = payload["output_path"]
    db.commit()
    db.refresh(row)
    return row.to_dict()
