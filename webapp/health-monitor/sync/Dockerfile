FROM python:3.12-slim

# Playwright wymaga zależności systemowych
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright Chromium — potrzebny do pierwszego logowania Garmin
RUN pip install playwright && playwright install --with-deps chromium

COPY . .

# Jednorazowe logowanie Garmin (generuje tokeny)
# Uruchamiane ręcznie przez: docker compose run sync python garmin_login.py
CMD ["python", "scheduler.py"]
