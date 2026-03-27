# Orders API Contract (backend)

Документ фиксирует актуальный backend-контракт для интеграции терминалов/фронта.

## 1) Создание заказа

**Endpoint:** `POST /orders/`

### Права
- `ADMIN`, `RECEPTION`
- Должна быть активная сессия (`require_active_session`)

### Request body
```json
{
  "client_id": 1,
  "client": {
    "name": "Иван",
    "phone": "+79990001122",
    "email": "ivan@example.com"
  },
  "color_id": 1,
  "model_id": 10,
  "size_id": 3,
  "print_id": 5
}
```

### Поля
- `client_id` *(optional)* — ID существующего клиента
- `client` *(optional)* — inline-создание/поиск клиента по телефону
- `color_id` *(optional)* — если не передан, берётся из `model.color_id`
- `model_id` *(required)*
- `size_id` *(required)*
- `print_id` *(optional)*

### Валидации
- Нельзя передавать одновременно `client_id` и `client`
- Нужно передать либо `client_id`, либо `client`
- Для inline `client` обязателен `client.phone`
- `model` должен существовать и быть `is_active=true`
- `size` должен существовать и быть `is_active=true`
- Связка `(model_id, size_id)` должна существовать в `catalog_model_sizes`
- `catalog_model_sizes.is_active` должен быть `true`
- `catalog_model_sizes.stock_qty > 0`
- Если передан `print_id`: print должен существовать и быть `is_active=true`
- Цвет должен совпадать с выбранной моделью
- Цвет должен существовать и быть `is_active=true`

### Побочные эффекты
- Заказ создаётся со статусом `new`
- `stock_qty` выбранной пары `model+size` уменьшается на `1`
- Пишется событие `order_created`

### Успешный ответ
- `200 OK`, модель `OrderRead`

### Типовые ошибки
- `400`:
  - `Either client_id or client data must be provided`
  - `Provide either client_id or client data, not both`
  - `client.phone is required when creating client inline`
  - `Model with id ... not found`
  - `Selected model is inactive`
  - `Size with id ... not found`
  - `Selected size is inactive`
  - `Invalid size or model provided`
  - `Selected model and size combination is inactive`
  - `Selected model and size combination is out of stock`
  - `Print with id ... not found`
  - `Selected print is inactive`
  - `Provided color_id does not match selected model`
  - `Color with id ... not found`
  - `Selected color is inactive`
- `403`: нет роли/нет активной сессии

---

## 2) Обновление каталожной части заказа

**Endpoint:** `PUT /orders/{order_id}/catalog`

### Права
- `ADMIN`, `RECEPTION`

### Ограничение по статусу
- Изменять можно только заказ в статусе `new`

### Request body
```json
{
  "color_id": 2,
  "model_id": 11,
  "size_id": 4,
  "print_id": 7
}
```

Все поля optional; если поле не передано — остаётся текущее значение заказа.

### Валидации
- Заказ должен существовать
- Новый `model`/`size` (или текущие, если не переданы) должны существовать и быть активны
- Пара `model+size` должна существовать в `catalog_model_sizes` и быть активной
- Если меняется пара `model+size`, у новой пары должен быть остаток `stock_qty > 0`
- Цвет должен соответствовать выбранной модели
- Цвет должен существовать и быть активным
- Если передан `print_id`, print должен существовать и быть активным

### Побочные эффекты (атомарно)
- Если пара `model+size` изменилась:
  - у старой пары `stock_qty += 1`
  - у новой пары `stock_qty -= 1`
- Пишется событие `order_catalog_updated`

### Успешный ответ
- `200 OK`, модель `OrderRead`

### Типовые ошибки
- `404`: `Order with id ... not found`
- `400`:
  - `Only orders in NEW status can be updated`
  - `Model with id ... not found`
  - `Selected model is inactive`
  - `Size with id ... not found`
  - `Selected size is inactive`
  - `Invalid model_id or size_id provided`
  - `Selected model and size combination is inactive`
  - `Selected model and size combination is out of stock`
  - `Provided color_id does not match selected model`
  - `Color with id ... not found`
  - `Selected color is inactive`
  - `Print with id ... not found`
  - `Selected print is inactive`

---

## 3) Поиск заказов (для Ресепшн / Выдача)

**Endpoint:** `GET /orders/search`

### Права
- `ADMIN`, `RECEPTION`, `ISSUE`

### Query-параметры
- `q` *(optional, string)* — строка поиска:
  - если только цифры, ищется `order_id`
  - также ищется в `client.name` и `client.phone`
- `status` *(optional, enum `OrderStatus`)* — фильтр по статусу
- `limit` *(optional, int, default=50, min=1, max=200)* — ограничение количества результатов

### Валидации / поведение
- Если `q` пустой, возвращаются последние заказы (с учётом `status`, если он передан)
- Поиск по `q` выполняется по принципу ИЛИ: `id` или `имя` или `телефон`
- Сортировка: новые заказы первыми (`id DESC`)

### Успешный ответ
- `200 OK`, список `OrderRead[]`

### Примеры
- По номеру заказа: `GET /orders/search?q=123`
- По имени клиента: `GET /orders/search?q=Иван`
- По телефону и статусу: `GET /orders/search?q=%2B7999&status=confirmed`

---

## 4) Быстрые примеры curl

> Подставить `<TOKEN>` и реальные id.

### Create order
```bash
curl -X POST "http://127.0.0.1:8000/orders/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "client": {"name": "Иван", "phone": "+79990001122"},
    "model_id": 10,
    "size_id": 3,
    "print_id": 5
  }'
```

### Update order catalog
```bash
curl -X PUT "http://127.0.0.1:8000/orders/123/catalog" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": 11,
    "size_id": 4
  }'
```
