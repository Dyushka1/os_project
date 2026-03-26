from datetime import datetime, timezone
import os
from database import SessionLocal
from models.users import User, Role
from models.sessions import SessionModel
from auth import hash_password

def run_seed()->None:
    db = SessionLocal()
    try:
        admin_username = os.getenv("ADMIN_USERNAME", "admin")
        admin_password = os.getenv("ADMIN_PASSWORD", "admin_pass")
        
        admin = db.query(User).filter(User.username == admin_username).first()
        if not admin:
            admin = User(
                username=admin_username,
                password_hash=hash_password(admin_password),
                role=Role.ADMIN
            )
            db.add(admin)
            db.commit()
            print(f"Admin user '{admin_username}' created.")
        else:
            print(f"Admin user '{admin_username}' already exists.")
        
        session = db.query(SessionModel).filter(SessionModel.is_active == True).first()
        if not session:
            new_session = SessionModel(is_active=True,
                                       started_at=datetime.now(timezone.utc),
                                       started_by_user_id=admin.id,
                                       has_nanesenie=True) 
            db.add(new_session)
            db.commit()
            print("Initial session started.")
        else:
            print("An active session already exists.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
    