from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas.users import UserCreate, UserRead, UserUpdate
from models.users import User, Role
from auth import hash_password, get_current_user, require_roles
import re

router = APIRouter(prefix="/users", tags=["users"])

PHONE_REGEX = re.compile(r"^\+?\d{10,15}$")


def canonicalize_phone(username: str) -> str:
    raw = username.strip()
    digits = raw[1:] if raw.startswith("+") else raw
    return f"+{digits}"


def normalize_username_for_role(username: str, role: Role | str) -> str:
    username_normalized = username.strip()

    role_value = role.value if isinstance(role, Role) else str(role).strip().lower()
    if role_value.startswith("role."):
        role_value = role_value.split(".", 1)[1]

    is_client_role = role_value == Role.USER.value

    if is_client_role and not PHONE_REGEX.fullmatch(username_normalized):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="For client registration username must be a valid phone number (+ and 10-15 digits)",
        )
    if is_client_role:
        return canonicalize_phone(username_normalized)
    return username_normalized


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc

@router.post("/register", response_model=UserRead)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    user.username = normalize_username_for_role(user.username, user.role)

    # Проверяем, есть ли уже такой username
    existing_user = db.query(User).filter(User.username == user.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    
    # Хешируем пароль
    hashed_password = hash_password(user.password)
    
    # Создаём пользователя
    new_user = User(
        username=user.username,
        password_hash=hashed_password,
        role=user.role
    )
    db.add(new_user)
    commit_with_rollback(db)
    db.refresh(new_user)
    return new_user


@router.get("/", response_model=list[UserRead])
def list_users(
    role: Role | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(current_user, [Role.ADMIN])
    query = db.query(User)
    if role is not None:
        query = query.filter(User.role == role)
    return query.order_by(User.id.asc()).all()


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(current_user, [Role.ADMIN])
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )

    next_role = payload.role if payload.role is not None else user.role
    next_username = payload.username if payload.username is not None else user.username
    next_username = normalize_username_for_role(next_username, next_role)

    if next_username != user.username:
        existing_user = db.query(User).filter(User.username == next_username).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered",
            )
        user.username = next_username

    if payload.role is not None:
        user.role = payload.role

    if payload.password is not None:
        user.password_hash = hash_password(payload.password)

    commit_with_rollback(db)
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin cannot delete self",
        )

    db.delete(user)
    commit_with_rollback(db)
    return {"detail": f"User {user_id} deleted"}
