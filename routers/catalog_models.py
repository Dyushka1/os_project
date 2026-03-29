from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models.catalog_colors import CatalogColors
from models.catalog_models import CatalogModel
from models.users import Role, User
from schemas.catalog_model import CatalogModelCreate, CatalogModelRead, CatalogModelUpdate


router = APIRouter(prefix="/catalog/models", tags=["catalog-models"])


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc


@router.get("/", response_model=list[CatalogModelRead])
def list_models(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    return db.query(CatalogModel).order_by(CatalogModel.id.asc()).all()


@router.get("/{model_id}", response_model=CatalogModelRead)
def get_model(model_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    item = db.query(CatalogModel).filter(CatalogModel.id == model_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return item


@router.post("/", response_model=CatalogModelRead)
def create_model(payload: CatalogModelCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    existing = db.query(CatalogModel).filter(CatalogModel.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Model name already exists")

    color = db.query(CatalogColors).filter(CatalogColors.id == payload.color_id).first()
    if color is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Color not found")

    item = CatalogModel(
        name=payload.name,
        garment_type=payload.garment_type.value if payload.garment_type is not None else None,
        color_id=payload.color_id,
        front_image_url=payload.front_image_url,
        back_image_url=payload.back_image_url,
        is_active=payload.is_active,
    )
    db.add(item)
    commit_with_rollback(db)
    db.refresh(item)
    return item


@router.put("/{model_id}", response_model=CatalogModelRead)
def update_model(model_id: int, payload: CatalogModelUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    item = db.query(CatalogModel).filter(CatalogModel.id == model_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")

    if payload.name is not None and payload.name != item.name:
        existing = db.query(CatalogModel).filter(CatalogModel.name == payload.name).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Model name already exists")
        item.name = payload.name

    if payload.garment_type is not None:
        item.garment_type = payload.garment_type.value

    if payload.color_id is not None:
        color = db.query(CatalogColors).filter(CatalogColors.id == payload.color_id).first()
        if color is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Color not found")
        item.color_id = payload.color_id

    if payload.front_image_url is not None:
        item.front_image_url = payload.front_image_url

    if payload.back_image_url is not None:
        item.back_image_url = payload.back_image_url

    if payload.is_active is not None:
        item.is_active = payload.is_active

    commit_with_rollback(db)
    db.refresh(item)
    return item


@router.delete("/{model_id}")
def delete_model(model_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    item = db.query(CatalogModel).filter(CatalogModel.id == model_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")

    db.delete(item)
    commit_with_rollback(db)
    return {"detail": f"Model {model_id} deleted"}
