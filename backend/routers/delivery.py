from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from auth import require_roles, get_current_user
from models.users import User, Role
from schemas.delivery import DeliveryCreate, DeliveryRead, DeliveryUpdate
from database import get_db
from models.delivery import Delivery

router = APIRouter(prefix="/delivery", tags=["delivery"])


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc


@router.get("/", response_model=list[DeliveryRead])
def list_deliveries(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION, Role.ISSUE])
    return db.query(Delivery).all()


@router.get("/{delivery_id}", response_model=DeliveryRead)
def get_delivery(delivery_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION, Role.ISSUE])
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if delivery is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery with id {delivery_id} not found",
        )
    return delivery


@router.post("/", response_model=DeliveryRead)
def create_delivery(data: DeliveryCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION, Role.ISSUE])
    new_delivery = Delivery(order_id=data.order_id, status=data.status)
    db.add(new_delivery)
    commit_with_rollback(db)
    db.refresh(new_delivery)
    return new_delivery


@router.put("/{delivery_id}", response_model=DeliveryRead)
def update_delivery(delivery_id: int, data: DeliveryUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION, Role.ISSUE])
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if delivery is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery with id {delivery_id} not found",
        )
    delivery.status = data.status
    commit_with_rollback(db)
    db.refresh(delivery)
    return delivery


@router.delete("/{delivery_id}")
def delete_delivery(delivery_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION, Role.ISSUE])
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if delivery is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery with id {delivery_id} not found",
        )
    db.delete(delivery)
    commit_with_rollback(db)
    return {"detail": f"Delivery {delivery_id} deleted"}
