import logging
import os
import smtplib
import urllib.request
import urllib.parse
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


def send_email(to_address: str, subject: str, body: str) -> None:
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_address
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(SMTP_USER, SMTP_PASSWORD)
        smtp.sendmail(SMTP_FROM, to_address, msg.as_string())


def send_telegram_message(chat_id: int | str, text: str) -> None:
    if not TELEGRAM_BOT_TOKEN:
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp.read()


def notify_order_ready(order_id: int, notify_method: str | None, notify_contact: str | None, telegram_chat_id: int | None, order_number: int | None = None) -> None:
    display = f"#{order_number}" if order_number else f"#{order_id}"
    logger.info("notify_order_ready called: order=%s display=%s method=%s chat_id=%s", order_id, display, notify_method, telegram_chat_id)
    if not notify_method or notify_method == "none":
        return

    if notify_method == "email" and notify_contact:
        try:
            send_email(
                to_address=notify_contact,
                subject=f"Ваш заказ {display} готов к выдаче",
                body=f"Здравствуйте!\n\nВаш заказ {display} готов! Подойдите к стойке выдачи.\n",
            )
            logger.info("Email notify sent for order %s to %s", order_id, notify_contact)
        except Exception as e:
            logger.error("Email notify failed for order %s: %s", order_id, e)

    elif notify_method == "telegram" and telegram_chat_id:
        try:
            send_telegram_message(
                chat_id=telegram_chat_id,
                text=f"Ваш заказ {display} готов! Подойдите к стойке выдачи.",
            )
            logger.info("Telegram notify sent for order %s to chat_id %s", order_id, telegram_chat_id)
        except Exception as e:
            logger.error("Telegram notify failed for order %s: %s", order_id, e)
    else:
        logger.warning("No notification sent for order %s: method=%s chat_id=%s", order_id, notify_method, telegram_chat_id)
