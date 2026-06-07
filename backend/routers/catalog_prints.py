from pathlib import Path
from time import time

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session

from auth import get_current_user_optional, get_current_user, require_roles
from database import get_db
from models.catalog_prints import CatalogPrint
from models.users import Role, User
from schemas.catalog_print import CatalogPrintCreate, CatalogPrintRead, CatalogPrintUpdate


router = APIRouter(prefix="/catalog/prints", tags=["catalog-prints"])

BASE_DIR = Path(__file__).resolve().parent.parent
PRINTS_DIR = BASE_DIR / "static" / "prints"
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


@router.get("/", response_model=list[CatalogPrintRead])
def list_prints(db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)):
    # public read access
    return db.query(CatalogPrint).order_by(CatalogPrint.id.asc()).all()


@router.delete("/all")
def delete_all_prints(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    deleted_count = db.query(CatalogPrint).delete(synchronize_session=False)
    commit_with_rollback(db)
    return {"deleted_count": deleted_count}


@router.get("/{print_id}", response_model=CatalogPrintRead)
def get_print(print_id: int, db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)):
    item = db.query(CatalogPrint).filter(CatalogPrint.id == print_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Print not found")
    return item


@router.post("/", response_model=CatalogPrintRead)
def create_print(payload: CatalogPrintCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    item = CatalogPrint(
        name=payload.name,
        print_type=payload.print_type,
        image_url=payload.image_url,
        width=payload.width,
        height=payload.height,
        stock_qty=payload.stock_qty,
        is_active=payload.is_active,
    )
    db.add(item)
    commit_with_rollback(db)
    db.refresh(item)
    return item


@router.put("/{print_id}", response_model=CatalogPrintRead)
def update_print(print_id: int, payload: CatalogPrintUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    item = db.query(CatalogPrint).filter(CatalogPrint.id == print_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Print not found")

    if payload.name is not None:
        item.name = payload.name

    if payload.print_type is not None:
        item.print_type = payload.print_type

    if payload.image_url is not None:
        item.image_url = payload.image_url

    if payload.width is not None:
        item.width = payload.width

    if payload.height is not None:
        item.height = payload.height

    if payload.stock_qty is not None:
        item.stock_qty = payload.stock_qty

    if payload.is_active is not None:
        item.is_active = payload.is_active

    commit_with_rollback(db)
    db.refresh(item)
    return item


@router.post("/{print_id}/upload", response_model=CatalogPrintRead)
async def upload_print_image(
    print_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_roles(current_user, [Role.ADMIN])

    item = db.query(CatalogPrint).filter(CatalogPrint.id == print_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Print not found")

    PRINTS_DIR.mkdir(parents=True, exist_ok=True)

    original_name = file.filename or "image.bin"
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is too large (max 5 MB)")

    previous_url = item.image_url
    if previous_url:
        previous_path = BASE_DIR / previous_url.lstrip("/")
        if previous_path.exists():
                        previous_path.unlink()

    safe_name = f"print_{print_id}_{int(time())}{extension}"
    save_path = PRINTS_DIR / safe_name
    save_path.write_bytes(content)

    item.image_url = f"/static/prints/{safe_name}"
    commit_with_rollback(db)
    db.refresh(item)
    return item


@router.delete("/{print_id}")
def delete_print(print_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])

    item = db.query(CatalogPrint).filter(CatalogPrint.id == print_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Print not found")

    db.delete(item)
    commit_with_rollback(db)
    return {"detail": f"Print {print_id} deleted"}
