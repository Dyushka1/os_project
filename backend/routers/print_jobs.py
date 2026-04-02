from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from auth import require_roles, get_current_user
from models.users import User, Role
from schemas.print import PrintJobCreate, PrintJobRead, PrintJobUpdate
from database import get_db
from models.print_job import PrintJob

router = APIRouter(prefix="/print_jobs", tags=["print_jobs"])


def commit_with_rollback(db: Session) -> None:
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed",
        ) from exc


@router.get("/", response_model=list[PrintJobRead])
def list_print_jobs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])
    return db.query(PrintJob).all()


@router.get("/{print_job_id}", response_model=PrintJobRead)
def get_print_job(print_job_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])
    job = db.query(PrintJob).filter(PrintJob.id == print_job_id).first()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Print job with id {print_job_id} not found",
        )
    return job


@router.post("/", response_model=PrintJobRead)
def create_print_job(print_job: PrintJobCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])
    new_print_job = PrintJob(order_id=print_job.order_id, status=print_job.status)
    db.add(new_print_job)
    commit_with_rollback(db)
    db.refresh(new_print_job)
    return new_print_job


@router.put("/{print_job_id}", response_model=PrintJobRead)
def update_print_job(print_job_id: int, data: PrintJobUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])
    job = db.query(PrintJob).filter(PrintJob.id == print_job_id).first()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Print job with id {print_job_id} not found",
        )
    job.status = data.status
    commit_with_rollback(db)
    db.refresh(job)
    return job


@router.delete("/{print_job_id}")
def delete_print_job(print_job_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, [Role.ADMIN, Role.PRINT])
    job = db.query(PrintJob).filter(PrintJob.id == print_job_id).first()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Print job with id {print_job_id} not found",
        )
    db.delete(job)
    commit_with_rollback(db)
    return {"detail": f"Print job {print_job_id} deleted"}
