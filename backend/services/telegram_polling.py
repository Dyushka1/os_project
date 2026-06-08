import json
import os
import re
import threading
import time
import urllib.request
import urllib.parse

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


def _normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits[0] == "8":
        digits = "7" + digits[1:]
    return digits


def _phones_match(a: str, b: str) -> bool:
    return _normalize_phone(a) == _normalize_phone(b)


def _api_get(method: str, **params) -> dict:
    qs = urllib.parse.urlencode(params)
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{method}?{qs}"
    with urllib.request.urlopen(url, timeout=35) as resp:
        return json.loads(resp.read())


def _send(chat_id: int, text: str) -> None:
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": text}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp.read()


INACTIVE_STATUSES = {"issued", "canceled"}


def _order_label(db, order) -> str:
    from models.orders import Order
    num = db.query(Order).filter(
        Order.session_id == order.session_id,
        Order.id <= order.id,
    ).count()
    return f"#{num}" if num else f"#{order.id}"


def _handle_message(message: dict) -> None:
    from database import SessionLocal
    from models.orders import Order

    chat_id = message.get("chat", {}).get("id")
    text = (message.get("text") or "").strip()

    if not chat_id:
        return

    if text.startswith("/start"):
        _send(chat_id, "Привет! Введите номер телефона, на который оформлен заказ — и я пришлю уведомление когда он будет готов.")
        return

    normalized = _normalize_phone(text)
    if len(normalized) >= 10:
        db = SessionLocal()
        try:
            all_telegram_orders = db.query(Order).filter(
                Order.notify_method == "telegram",
            ).all()

            all_matched = [o for o in all_telegram_orders if o.notify_contact and _phones_match(o.notify_contact, normalized)]
            active_matched = [o for o in all_matched if o.status not in INACTIVE_STATUSES]

            if not all_matched:
                _send(chat_id, "Заказов с этим номером не найдено. Проверьте номер или обратитесь к менеджеру.")
                return

            if not active_matched:
                _send(chat_id, "Активных заказов с этим номером нет — все уже выданы или отменены.")
                return

            unlinked = [o for o in active_matched if o.telegram_chat_id is None]
            already_linked = [o for o in active_matched if o.telegram_chat_id is not None]

            if unlinked:
                for order in unlinked:
                    order.telegram_chat_id = chat_id
                db.commit()
                ids = ", ".join(_order_label(db, o) for o in unlinked)
                _send(chat_id, f"Готово! Привязал {len(unlinked)} заказ(ов): {ids}. Пришлю уведомление когда будут готовы к выдаче.")
            else:
                for order in already_linked:
                    order.telegram_chat_id = chat_id
                db.commit()
                ids = ", ".join(_order_label(db, o) for o in already_linked)
                _send(chat_id, f"Ваши заказы ({ids}) уже привязаны к этому боту. Уведомление придёт когда будут готовы к выдаче.")
        finally:
            db.close()


def _polling_loop() -> None:
    offset = 0
    while True:
        try:
            data = _api_get("getUpdates", offset=offset, timeout=30)
            for update in data.get("result", []):
                offset = update["update_id"] + 1
                msg = update.get("message") or update.get("edited_message")
                if msg:
                    try:
                        _handle_message(msg)
                    except Exception:
                        pass
        except Exception:
            time.sleep(5)


def start_polling() -> None:
    if not TELEGRAM_BOT_TOKEN:
        return
    t = threading.Thread(target=_polling_loop, daemon=True)
    t.start()
