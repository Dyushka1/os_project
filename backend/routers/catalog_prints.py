from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models.catalog_prints import CatalogPrint
from models.users import Role, User
from schemas.catalog_print import CatalogPrintCreate, CatalogPrintRead, CatalogPrintUpdate


router = APIRouter(prefix="/catalog/prints", tags=["catalog-prints"])


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
def list_prints(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
    return db.query(CatalogPrint).order_by(CatalogPrint.id.asc()).all()


@router.get("/{print_id}", response_model=CatalogPrintRead)
def get_print(print_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN])
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

    if payload.stock_qty is not None:
        item.stock_qty = payload.stock_qty

    if payload.is_active is not None:
        item.is_active = payload.is_active

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
