from fastapi import FastAPI
import uvicorn
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
)
from database import Base, engine
from models.orders import Order
from models.clients import Client
from models.delivery import Delivery
from models.print_job import PrintJob
from models.sessions import SessionModel
from models.order_events import OrderEvent



app = FastAPI()
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

@app.get("/")
def root():
    return {"message": "Backend works"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)