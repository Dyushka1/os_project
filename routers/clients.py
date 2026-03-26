from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from auth import require_roles, get_current_user
from models.users import User, Role
from schemas.clients import ClientCreate, ClientRead, ClientUpdate
from database import get_db
from models.clients import Client


router = APIRouter(prefix="/clients", tags=["clients"])


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc


@router.get("/", response_model=list[ClientRead])
def list_clients(current_user: User = Depends(get_current_user),
                 phone: str | None = None,
                 name: str | None = None,
                 db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    query = db.query(Client)
    if phone:
        query = query.filter(Client.phone == phone)
    if name:
        query = query.filter(Client.name == name)
    return query.all()

    
@router.get("/{client_id}", response_model=ClientRead)
def get_client(client_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id {client_id} not found",
        )
    return client


@router.post("/", response_model=ClientRead)
def create_client(client: ClientCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    new_client = Client(name=client.name, phone=client.phone, email=client.email)
    db.add(new_client)
    commit_with_rollback(db)
    db.refresh(new_client)
    return new_client


@router.put("/{client_id}", response_model=ClientRead)
def update_client(client_id: int, data: ClientUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id {client_id} not found",
        )
    client.name = data.name
    client.phone = data.phone
    client.email = data.email
    commit_with_rollback(db)
    db.refresh(client)
    return client


@router.delete("/{client_id}")
def delete_client(client_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.RECEPTION])
    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id {client_id} not found",
        )
    db.delete(client)
    commit_with_rollback(db)
    return {"detail": f"Client {client_id} deleted"}