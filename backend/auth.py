from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from models.users import User, Role
from fastapi import Depends
from models.sessions import SessionModel
from database import get_db
import os
import re
from dotenv import load_dotenv


load_dotenv()  # Загружаем переменные окружения из .env файла

# Настройки для JWT
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
PHONE_REGEX = re.compile(r"^\+?\d{10,15}$")

def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')
    password = password_bytes.decode('utf-8', errors='ignore')
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode('utf-8')
    plain_password = password_bytes.decode('utf-8', errors='ignore')
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_user_by_username(db: Session, username: str) -> User | None:
    username_normalized = username.strip()
    user = db.query(User).filter(User.username == username_normalized).first()
    if user is not None:
        return user

    if PHONE_REGEX.fullmatch(username_normalized):
        alternate = username_normalized[1:] if username_normalized.startswith("+") else f"+{username_normalized}"
        return db.query(User).filter(User.username == alternate).first()

    return None

def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt import PyJWTError

security = HTTPBearer(auto_error=False)

def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security), db: Session = Depends(get_db)) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_user_optional(credentials: HTTPAuthorizationCredentials | None = Depends(security), db: Session = Depends(get_db)) -> User | None:
    """Try to get current user from Authorization header. If no valid credentials present, return None instead of raising.

    Useful for endpoints that allow anonymous access but still accept authenticated requests.
    """
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except PyJWTError:
        return None

    user = get_user_by_username(db, username)
    return user

from fastapi import HTTPException, status

def require_roles(user: User, allowed: list[Role]):
    if user.role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
def  require_active_session(db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active session")
    return session