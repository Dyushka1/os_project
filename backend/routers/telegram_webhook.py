import os
import re
import json
import urllib.request
from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.orders import Order

router = APIRouter(prefix="/telegram", tags=["telegram"])

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
INACTIVE_STATUSES = {"issued", "canceled"}


def _order_label(db: Session, order: Order) -> str:
    num = db.query(Order).filter(
        Order.session_id == order.session_id,
        Order.id <= order.id,
    ).count()
    return f"#{num}" if num else f"#{order.id}"

def _normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits[0] == "8":
        digits = "7" + digits[1:]
    return digits


def _phones_match(a: str, b: str) -> bool:
    return _normalize_phone(a) == _normalize_phone(b)


def _send_telegram_message(chat_id: int | str, text: str) -> None:
    if not TELEGRAM_BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp.read()


@router.post("/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        return {"ok": True}

    message = body.get("message") or body.get("edited_message")
    if not message:
        return {"ok": True}

    chat_id = message.get("chat", {}).get("id")
    text = (message.get("text") or "").strip()

    if not chat_id:
        return {"ok": True}

    if text.startswith("/start"):
        _send_telegram_message(chat_id, "Привет! Введите номер телефона, на который оформлен заказ — и я пришлю уведомление когда он будет готов.")
        return {"ok": True}

    normalized = _normalize_phone(text)
    if len(normalized) >= 10:

        all_telegram_orders = db.query(Order).filter(
            Order.notify_method == "telegram",
        ).all()

        all_matched = [o for o in all_telegram_orders if o.notify_contact and _phones_match(o.notify_contact, normalized)]
        active_matched = [o for o in all_matched if o.status not in INACTIVE_STATUSES]

        if not all_matched:
            _send_telegram_message(chat_id, "Заказов с этим номером не найдено. Проверьте номер или обратитесь к менеджеру.")
            return {"ok": True}

        if not active_matched:
            _send_telegram_message(chat_id, "Активных заказов с этим номером нет — все уже выданы или отменены.")
            return {"ok": True}

        unlinked = [o for o in active_matched if o.telegram_chat_id is None]
        already_linked = [o for o in active_matched if o.telegram_chat_id is not None]

        if unlinked:
            for order in unlinked:
                order.telegram_chat_id = chat_id
            db.commit()
            ids = ", ".join(_order_label(db, o) for o in unlinked)
            _send_telegram_message(chat_id, f"Готово! Привязал {len(unlinked)} заказ(ов): {ids}. Пришлю уведомление когда будут готовы к выдаче.")
        else:
            for order in already_linked:
                order.telegram_chat_id = chat_id
            db.commit()
            ids = ", ".join(_order_label(db, o) for o in already_linked)
            _send_telegram_message(chat_id, f"Ваши заказы ({ids}) уже привязаны к этому боту. Уведомление придёт когда будут готовы к выдаче.")

    return {"ok": True}
