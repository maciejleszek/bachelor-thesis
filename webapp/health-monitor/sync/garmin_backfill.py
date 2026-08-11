"""
Jednorazowy backfill pełnej historii dziennych metryk z Garmin Connect.

Uruchamiane ręcznie:
    docker compose run --rm sync python garmin_backfill.py

Garmin API nie udostępnia daty założenia konta / pierwszego dnia z danymi,
więc skanujemy dzień po dniu wstecz od dziś i przerywamy, gdy trafimy na
EMPTY_DAY_STOP kolejnych dni bez żadnych realnych danych (uznajemy to za
okres sprzed posiadania urządzenia).

Postęp jest zapisywany do pliku na dysku, więc przerwanie (Ctrl+C, restart
kontenera) i ponowne uruchomienie tej samej komendy wznawia od ostatniego
przetworzonego dnia zamiast zaczynać od nowa.
"""

import asyncio
import json
import logging
import os
from datetime import date, timedelta
from pathlib import Path

import asyncpg

import garmin_sync

log = logging.getLogger("garmin_backfill")

PROGRESS_FILE = Path(os.getenv("GARMIN_BACKFILL_PROGRESS_FILE", "/data/garmin_backfill_progress.json"))
EMPTY_DAY_STOP = int(os.getenv("GARMIN_BACKFILL_EMPTY_DAY_STOP", "90"))
REQUEST_DELAY = float(os.getenv("GARMIN_BACKFILL_REQUEST_DELAY", "0.5"))
MAX_LOOKBACK_DAYS = int(os.getenv("GARMIN_BACKFILL_MAX_LOOKBACK_DAYS", "3650"))  # ~10 lat, zabezpieczenie


def _load_progress() -> dict:
    if PROGRESS_FILE.exists():
        try:
            return json.loads(PROGRESS_FILE.read_text())
        except json.JSONDecodeError:
            log.warning("Uszkodzony plik postępu %s — zaczynam od nowa", PROGRESS_FILE)
    return {}


def _save_progress(next_date: date, empty_streak: int, inserted: int):
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROGRESS_FILE.write_text(json.dumps({
        "next_date": next_date.isoformat(),
        "empty_streak": empty_streak,
        "inserted_total": inserted,
    }))


async def run_backfill():
    if not garmin_sync.GARMIN_EMAIL or not garmin_sync.GARMIN_PASS:
        log.error("Brak GARMIN_EMAIL lub GARMIN_PASSWORD w .env!")
        return

    progress = _load_progress()
    cursor = date.fromisoformat(progress["next_date"]) if "next_date" in progress else date.today()
    empty_streak = progress.get("empty_streak", 0)
    inserted = progress.get("inserted_total", 0)

    if "next_date" in progress:
        log.info("Wznawiam backfill od %s (dotychczas zapisano %d dni)", cursor, inserted)
    else:
        log.info("Rozpoczynam nowy backfill od dziś wstecz")

    try:
        client = garmin_sync._get_client()
    except Exception as e:
        log.error("Nie można połączyć się z Garmin Connect: %s", e)
        return

    conn = await asyncpg.connect(garmin_sync.DB_URL)
    oldest_allowed = date.today() - timedelta(days=MAX_LOOKBACK_DAYS)

    try:
        target = cursor
        while target >= oldest_allowed:
            ds = target.isoformat()
            try:
                row = await garmin_sync.fetch_day_metrics(client, target)
            except Exception as e:
                log.error("Błąd dnia %s, przerywam (uruchom ponownie, żeby wznowić): %s", ds, e)
                break

            if garmin_sync.has_useful_data(row):
                await garmin_sync._upsert_metrics(conn, row)
                inserted += 1
                empty_streak = 0
                log.info("[Backfill] ✓ %s zapisany (łącznie: %d)", ds, inserted)
            else:
                empty_streak += 1
                log.info("[Backfill] — %s bez danych (pusto pod rząd: %d/%d)",
                          ds, empty_streak, EMPTY_DAY_STOP)

            target -= timedelta(days=1)
            _save_progress(target, empty_streak, inserted)

            if empty_streak >= EMPTY_DAY_STOP:
                log.info("[Backfill] Trafiono %d dni bez danych pod rząd — "
                          "zakładam koniec historii urządzenia. Kończę na %s.",
                          EMPTY_DAY_STOP, ds)
                break

            await asyncio.sleep(REQUEST_DELAY)
        else:
            log.info("[Backfill] Osiągnięto limit %d dni wstecz — kończę.", MAX_LOOKBACK_DAYS)

        log.info("[Backfill] Zakończono. Zapisano %d dni z danymi.", inserted)
    finally:
        await conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                         format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(run_backfill())
