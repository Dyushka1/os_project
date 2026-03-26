from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models.catalog_colors import CatalogColors
from models.users import Role, User
from schemas.catalog_color import CatalogColorCreate, CatalogColorRead, CatalogColorUpdate

router = APIRouter(prefix="/catalog/colors", tags=["catalog-colors"])


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc
        
        
@router.get("/", response_model=list[CatalogColorRead])
def list_colors(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    return db.query(CatalogColors).order_by(CatalogColors.id.asc()).all()

@router.get("/{color_id}", response_model=CatalogColorRead)
def get_color(color_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    color = db.query(CatalogColors).filter(CatalogColors.id == color_id).first()
    if color is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Color not found")
    return color

@router.post("/", response_model=CatalogColorRead)
def create_color(color: CatalogColorCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    
    existing = db.query(CatalogColors).filter(CatalogColors.name == color.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Color name already exists")    
    color = CatalogColors(name=color.name,
                          hex_code=color.hex_code,
                          is_active=color.is_active)
    db.add(color)
    commit_with_rollback(db)
    db.refresh(color)
    return color

@router.put("/{color_id}", response_model=CatalogColorRead)
def update_color(color_id: int, color: CatalogColorUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    existing = db.query(CatalogColors).filter(CatalogColors.id == color_id).first()
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Color not found")
    if color.name is not None:
        existing.name = color.name
    if color.hex_code is not None:
        existing.hex_code = color.hex_code
    if color.is_active is not None:
        existing.is_active = color.is_active
    commit_with_rollback(db)
    db.refresh(existing)
    return existing

@router.delete("/{color_id}" )
def delete_color(color_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    color = db.query(CatalogColors).filter(CatalogColors.id == color_id).first()
    if color is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Color not found")
    db.delete(color)
    commit_with_rollback(db)
    return {"detail": "Color deleted successfully"}