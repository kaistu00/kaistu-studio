import os
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.api_key import APIKey

router = APIRouter()

_KEY_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".encryption_key")

_key = None
def _get_key() -> bytes:
    global _key
    if _key is None:
        key = os.environ.get("KAISTU_ENCRYPTION_KEY")
        if not key and os.path.exists(_KEY_FILE):
            key = open(_KEY_FILE).read().strip()
        if not key:
            key = Fernet.generate_key().decode()
            os.environ["KAISTU_ENCRYPTION_KEY"] = key
            with open(_KEY_FILE, "w") as f:
                f.write(key)
        _key = key.encode() if isinstance(key, str) else key
    return _key

fernet = None
def _get_fernet():
    global fernet
    if fernet is None:
        fernet = Fernet(_get_key())
    return fernet

class APIKeyCreate(BaseModel):
    service: str
    api_key: str

def encrypt(key: str) -> str:
    return _get_fernet().encrypt(key.encode()).decode()

def decrypt(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()

@router.post("/api-keys")
async def create_api_key(payload: APIKeyCreate, db: Session = Depends(get_db)):
    existing = db.query(APIKey).filter(APIKey.service == payload.service).first()
    if existing:
        existing.encrypted_key = encrypt(payload.api_key)
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "service": existing.service}
    key = APIKey(service=payload.service, encrypted_key=encrypt(payload.api_key))
    db.add(key)
    db.commit()
    db.refresh(key)
    return {"id": key.id, "service": key.service}

@router.get("/api-keys")
async def list_api_keys(db: Session = Depends(get_db)):
    keys = db.query(APIKey).all()
    return [{"id": k.id, "service": k.service} for k in keys]

@router.delete("/api-keys/{service}")
async def delete_api_key(service: str, db: Session = Depends(get_db)):
    key = db.query(APIKey).filter(APIKey.service == service).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    db.delete(key)
    db.commit()
    return {"deleted": service}