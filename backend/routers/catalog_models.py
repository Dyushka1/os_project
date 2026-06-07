from pathlib import Path
from time import time

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session

from auth import get_current_user, get_current_user_optional, require_roles
from database import get_db
from models.catalog_colors import CatalogColors
from models.catalog_models import CatalogModel
from models.users import Role, User
from schemas.catalog_model import CatalogModelCreate, CatalogModelRead, CatalogModelUpdate


router = APIRouter(prefix="/catalog/models", tags=["catalog-models"])

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "static" / "models"
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


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
def list_models(db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)):
    # public read access
    return db.query(CatalogModel).order_by(CatalogModel.id.asc()).all()


@router.delete("/all")
def delete_all_models(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    deleted_count = db.query(CatalogModel).delete(synchronize_session=False)
    commit_with_rollback(db)
    return {"deleted_count": deleted_count}


@router.get("/{model_id}", response_model=CatalogModelRead)
def get_model(model_id: int, db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)):
    # public read access
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

    # optional default print
    if payload.default_print_id is not None:
        from models.catalog_prints import CatalogPrint
        p = db.query(CatalogPrint).filter(CatalogPrint.id == payload.default_print_id).first()
        if p is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Default print not found")

    item = CatalogModel(
        name=payload.name,
        garment_type=payload.garment_type if payload.garment_type is not None else None,
        color_id=payload.color_id,
        front_image_url=payload.front_image_url,
        back_image_url=payload.back_image_url,
        default_print_id=payload.default_print_id,
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
        item.garment_type = payload.garment_type

    if payload.color_id is not None:
        color = db.query(CatalogColors).filter(CatalogColors.id == payload.color_id).first()
        if color is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Color not found")
        item.color_id = payload.color_id

    if payload.front_image_url is not None:
        item.front_image_url = payload.front_image_url

    if payload.back_image_url is not None:
        item.back_image_url = payload.back_image_url

    if payload.default_print_id is not None:
        from models.catalog_prints import CatalogPrint
        p = db.query(CatalogPrint).filter(CatalogPrint.id == payload.default_print_id).first()
        if p is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Default print not found")
        item.default_print_id = payload.default_print_id

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


@router.post("/{model_id}/upload", response_model=CatalogModelRead)
async def upload_model_image(
    model_id: int,
    side: str = Form(...),  # 'front' or 'back'
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN])

    if side not in ("front", "back"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Side must be 'front' or 'back'")

    item = db.query(CatalogModel).filter(CatalogModel.id == model_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    original_name = file.filename or "image.bin"
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is too large (max 5 MB)")

    safe_name = f"model_{model_id}_{int(time())}{extension}"
    save_path = MODELS_DIR / safe_name

    previous_url = item.front_image_url if side == "front" else item.back_image_url
    if previous_url:
        previous_path = BASE_DIR / previous_url.lstrip("/")
        if previous_path.exists() and previous_path != save_path:
            previous_path.unlink()

    save_path.write_bytes(content)

    file_url = f"/static/models/{safe_name}"
    if side == "front":
        item.front_image_url = file_url
    else:
        item.back_image_url = file_url

    commit_with_rollback(db)
    db.refresh(item)
    return item
