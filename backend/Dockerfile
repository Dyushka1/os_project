FROM python:3.12-slim

WORKDIR /app

# Копируем только requirements, чтобы кеш слоев Docker работал
COPY requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir -r /app/requirements.txt

# Копируем весь код
COPY . /app/

EXPOSE 8000

# Берем порт из переменной среды, если есть
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "${PORT:-8000}"]