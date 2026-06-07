from pathlib import Path
from time import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models.branding_assets import BrandingAsset
from models.users import Role, User
from schemas.branding import BrandingAssetRead, BrandingColorUpdate


router = APIRouter(prefix="/branding", tags=["branding"])

ALLOWED_KEYS = {"kiosk-bg", "kiosk-splash", "board-bg", "logo", "palette"}
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
ALLOWED_PALETTE_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | {".json"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
BASE_DIR = Path(__file__).resolve().parent.parent
BRANDING_DIR = BASE_DIR / "static" / "branding"


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc


def get_or_create_asset(db: Session, asset_key: str) -> BrandingAsset:
    asset = db.query(BrandingAsset).filter(BrandingAsset.asset_key == asset_key).first()
    if asset is not None:
        return asset

    asset = BrandingAsset(asset_key=asset_key)
    db.add(asset)
    commit_with_rollback(db)
    db.refresh(asset)
    return asset


@router.get("/assets", response_model=list[BrandingAssetRead])
def list_assets(db: Session = Depends(get_db)):
    return db.query(BrandingAsset).order_by(BrandingAsset.asset_key.asc()).all()


@router.post("/assets/{asset_key}/upload", response_model=BrandingAssetRead)
async def upload_asset(
    asset_key: str,
    file: UploadFile = File(...),
    color_value: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN])

    if asset_key not in ALLOWED_KEYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported branding asset key")

    BRANDING_DIR.mkdir(parents=True, exist_ok=True)

    original_name = file.filename or "asset.bin"
    extension = Path(original_name).suffix.lower()
    safe_extension = extension if extension else ".bin"

    allowed_extensions = ALLOWED_PALETTE_EXTENSIONS if asset_key == "palette" else ALLOWED_IMAGE_EXTENSIONS
    if safe_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type for this branding asset",
        )

    safe_name = f"{asset_key}_{int(time())}{safe_extension}"
    save_path = BRANDING_DIR / safe_name

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is too large (max 5 MB)",
        )
    save_path.write_bytes(content)

    asset = get_or_create_asset(db, asset_key)
    asset.file_name = original_name
    asset.file_url = f"/static/branding/{safe_name}"
    if color_value is not None:
        asset.color_value = color_value

    commit_with_rollback(db)
    db.refresh(asset)
    return asset


@router.put("/assets/{asset_key}/color", response_model=BrandingAssetRead)
def update_color(
    asset_key: str,
    payload: BrandingColorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN])

    if asset_key not in ALLOWED_KEYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported branding asset key")

    color_value = payload.color_value.strip()
    if not color_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="color_value is required")

    asset = get_or_create_asset(db, asset_key)
    asset.color_value = color_value

    commit_with_rollback(db)
    db.refresh(asset)
    return asset
