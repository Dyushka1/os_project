from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models.catalog_sizes import CatalogSize
from models.users import Role, User
from schemas.catalog_size import CatalogSizeCreate, CatalogSizeRead, CatalogSizeUpdate


router = APIRouter(prefix="/catalog/sizes", tags=["catalog-sizes"])


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc


@router.get("/", response_model=list[CatalogSizeRead])
def list_sizes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    return db.query(CatalogSize).order_by(CatalogSize.sort_order.asc(), CatalogSize.id.asc()).all()


@router.get("/{size_id}", response_model=CatalogSizeRead)
def get_size(size_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    size = db.query(CatalogSize).filter(CatalogSize.id == size_id).first()
    if size is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Size not found")
    return size


@router.post("/", response_model=CatalogSizeRead)
def create_size(payload: CatalogSizeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    existing = db.query(CatalogSize).filter(CatalogSize.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Size code already exists")

    item = CatalogSize(code=payload.code, sort_order=payload.sort_order, is_active=payload.is_active)
    db.add(item)
    commit_with_rollback(db)
    db.refresh(item)
    return item


@router.put("/{size_id}", response_model=CatalogSizeRead)
def update_size(size_id: int, payload: CatalogSizeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    item = db.query(CatalogSize).filter(CatalogSize.id == size_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Size not found")

    if payload.code is not None and payload.code != item.code:
        existing = db.query(CatalogSize).filter(CatalogSize.code == payload.code).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Size code already exists")
        item.code = payload.code

    if payload.sort_order is not None:
        item.sort_order = payload.sort_order

    if payload.is_active is not None:
        item.is_active = payload.is_active

    commit_with_rollback(db)
    db.refresh(item)
    return item


@router.delete("/{size_id}")
def delete_size(size_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    item = db.query(CatalogSize).filter(CatalogSize.id == size_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Size not found")

    db.delete(item)
    commit_with_rollback(db)
    return {"detail": f"Size {size_id} deleted"}
