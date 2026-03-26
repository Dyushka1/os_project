from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from auth import get_current_user, require_roles
from models.users import User, Role
from models.sessions import SessionModel
from schemas.sessions import SessionRead
from database import get_db
from datetime import datetime, timezone


router = APIRouter(prefix="/sessions", tags=["sessions"])


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc

@router.post("/start", response_model=SessionRead)
def start_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])
    session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
    if session:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session already active")
    new_session = SessionModel(is_active=True, started_at=datetime.now(timezone.utc), started_by_user_id=current_user.id)
    db.add(new_session)
    commit_with_rollback(db)
    db.refresh(new_session)
    return new_session

@router.post("/stop", response_model=SessionRead)
def stop_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN])
    session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active session to stop")
    session.is_active = False
    session.stopped_at = datetime.now(timezone.utc)
    session.stopped_by_user_id = current_user.id
    commit_with_rollback(db)
    db.refresh(session)
    return session


    