from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models.promo_codes import PromoCode
from models.users import Role, User
from schemas.promo_codes import PromoCodeCreate, PromoCodeRead, PromoCodeUpdate

router = APIRouter(prefix="/promo-codes", tags=["promo-codes"])


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc


@router.get("/", response_model=list[PromoCodeRead])
def list_promo_codes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    return db.query(PromoCode).order_by(PromoCode.id.asc()).all()


@router.get("/validate")
def validate_promo_code(code: str, db: Session = Depends(get_db)):
    promo = db.query(PromoCode).filter(PromoCode.code == code, PromoCode.is_active == True).first()
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Промокод не найден или неактивен")
    return {"valid": True, "code": promo.code, "description": promo.description}


@router.post("/", response_model=PromoCodeRead, status_code=status.HTTP_201_CREATED)
def create_promo_code(data: PromoCodeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    existing = db.query(PromoCode).filter(PromoCode.code == data.code).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Промокод с таким кодом уже существует")
    promo = PromoCode(code=data.code.strip().upper(), description=data.description)
    db.add(promo)
    commit_with_rollback(db)
    db.refresh(promo)
    return promo


@router.patch("/{promo_id}", response_model=PromoCodeRead)
def update_promo_code(promo_id: int, data: PromoCodeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    promo = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Промокод не найден")
    if data.description is not None:
        promo.description = data.description
    if data.is_active is not None:
        promo.is_active = data.is_active
    commit_with_rollback(db)
    db.refresh(promo)
    return promo


@router.delete("/{promo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_promo_code(promo_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    promo = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Промокод не найден")
    db.delete(promo)
    commit_with_rollback(db)
