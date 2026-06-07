from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import uvicorn
from pathlib import Path
from routers import (
    orders,
    login,
    clients,
    delivery,
    print_jobs,
    users,
    sessions,
    stats,
    health,
    catalog_color,
    catalog_sizes,
    catalog_models,
    catalog_prints,
    catalog_model_sizes,
    branding,
    promo_codes,
)
from database import Base, engine
from models.orders import Order
from models.clients import Client
from models.delivery import Delivery
from models.print_job import PrintJob
from models.sessions import SessionModel
from models.order_events import OrderEvent
from models.promo_codes import PromoCode
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(orders.router)
app.include_router(login.router)
app.include_router(clients.router)
app.include_router(delivery.router)
app.include_router(print_jobs.router)
app.include_router(users.router)
app.include_router(sessions.router)
app.include_router(stats.router)
app.include_router(health.router)
app.include_router(catalog_color.router)
app.include_router(catalog_sizes.router)
app.include_router(catalog_models.router)
app.include_router(catalog_prints.router)
app.include_router(catalog_model_sizes.router)
app.include_router(branding.router)
app.include_router(promo_codes.router)

STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def root():
    return {"message": "Backend works"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)