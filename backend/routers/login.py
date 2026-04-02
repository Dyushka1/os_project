from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas.login import LoginRequest
from auth import authenticate_user, create_access_token
from datetime import timedelta

router = APIRouter(prefix="/login", tags=["login"])

@router.post("/")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, data.username, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    
    # Создаём токен
    access_token_expires = timedelta(minutes=30)  # Или из auth.py
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value},  # sub — стандарт для JWT
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}