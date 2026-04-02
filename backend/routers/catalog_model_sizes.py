from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models.catalog_model_sizes import CatalogModelSize
from models.catalog_models import CatalogModel
from models.catalog_sizes import CatalogSize
from models.users import Role, User
from schemas.catalog_model_size import (
    CatalogModelSizeCreate,
    CatalogModelSizeRead,
    CatalogModelSizeUpdate,
)


router = APIRouter(prefix="/catalog/model-sizes", tags=["catalog-model-sizes"])


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc


@router.get("/", response_model=list[CatalogModelSizeRead])
def list_model_sizes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    return db.query(CatalogModelSize).order_by(CatalogModelSize.id.asc()).all()


@router.get("/{item_id}", response_model=CatalogModelSizeRead)
def get_model_size(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    item = db.query(CatalogModelSize).filter(CatalogModelSize.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model-size link not found")
    return item


@router.post("/", response_model=CatalogModelSizeRead)
def create_model_size(payload: CatalogModelSizeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    model = db.query(CatalogModel).filter(CatalogModel.id == payload.model_id).first()
    if model is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Model not found")

    size = db.query(CatalogSize).filter(CatalogSize.id == payload.size_id).first()
    if size is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Size not found")

    existing = (
        db.query(CatalogModelSize)
        .filter(
            CatalogModelSize.model_id == payload.model_id,
            CatalogModelSize.size_id == payload.size_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This model-size pair already exists",
        )

    item = CatalogModelSize(
        model_id=payload.model_id,
        size_id=payload.size_id,
        stock_qty=payload.stock_qty,
        is_active=payload.is_active,
    )
    db.add(item)
    commit_with_rollback(db)
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=CatalogModelSizeRead)
def update_model_size(item_id: int, payload: CatalogModelSizeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    item = db.query(CatalogModelSize).filter(CatalogModelSize.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model-size link not found")

    new_model_id = payload.model_id if payload.model_id is not None else item.model_id
    new_size_id = payload.size_id if payload.size_id is not None else item.size_id

    if payload.model_id is not None:
        model = db.query(CatalogModel).filter(CatalogModel.id == payload.model_id).first()
        if model is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Model not found")

    if payload.size_id is not None:
        size = db.query(CatalogSize).filter(CatalogSize.id == payload.size_id).first()
        if size is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Size not found")

    pair_conflict = (
        db.query(CatalogModelSize)
        .filter(
            CatalogModelSize.model_id == new_model_id,
            CatalogModelSize.size_id == new_size_id,
            CatalogModelSize.id != item_id,
        )
        .first()
    )
    if pair_conflict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This model-size pair already exists",
        )

    if payload.model_id is not None:
        item.model_id = payload.model_id
    if payload.size_id is not None:
        item.size_id = payload.size_id
    if payload.stock_qty is not None:
        item.stock_qty = payload.stock_qty
    if payload.is_active is not None:
        item.is_active = payload.is_active

    commit_with_rollback(db)
    db.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_model_size(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    item = db.query(CatalogModelSize).filter(CatalogModelSize.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model-size link not found")

    db.delete(item)
    commit_with_rollback(db)
    return {"detail": f"Model-size link {item_id} deleted"}
