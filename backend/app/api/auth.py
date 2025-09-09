from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Cookie
from sqlalchemy.orm import Session
from datetime import timedelta
import os

from app.db.session import SessionLocal
from app.db import models
from app.schemas.user import UserCreate, UserLogin, UserOut
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

COOKIE_NAME = "session"

@router.post("/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter_by(email=user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = models.User(email=user.email, password_hash=hash_password(user.password))
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login")
def login(user: UserLogin, response: Response, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter_by(email=user.email).first()
    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token({"sub": str(db_user.id)}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

    IS_PROD = os.getenv("ENV") == "prod"
    response.set_cookie(
        key=COOKIE_NAME,
        value=access_token,
        httponly=True,
        path="/",
        max_age=60 * 60 * 24 * 7,
        secure=IS_PROD,
        samesite="none" if IS_PROD else "lax",
    )

    return {"message": "Logged in successfully"}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
    )
    return {"message": "Logged out"}

@router.get("/me", response_model=UserOut)
def me(
    session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
):
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_access_token(session)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = int(payload["sub"])
    db_user = db.query(models.User).get(user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    return db_user
