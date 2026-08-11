"""
Garmin Connect → PostgreSQL sync
"""

import os
import asyncio
import asyncpg
import logging
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("garmin_sync")

DB_URL       = os.getenv("DATABASE_URL", "postgresql://health:changeme@db:5432/health")
GARMIN_EMAIL = os.getenv("GARMIN_EMAIL")
GARMIN_PASS  = os.getenv("GARMIN_PASSWORD")
TOKEN_DIR    = Path(os.getenv("GARMIN_TOKEN_DIR", "/data/garmin_tokens"))


def _get_client():
    """
    Zwraca zalogowanego klienta Garmin Connect.
    garminconnect używa garth wewnętrznie — tokeny zapisywane są
    w katalogu wskazanym przez GARTHOME.
    """
    from garminconnect import Garmin

    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["GARTHOME"] = str(TOKEN_DIR)

    client = Garmin(GARMIN_EMAIL, GARMIN_PASS)

    token_file = TOKEN_DIR / "oauth2_token.json"
    if token_file.exists():
        log.info("Ładowanie tokenów z dysku (GARTHOME=%s)...", TOKEN_DIR)
        try:
            client.login()
            log.info("Zalogowano przez tokeny")
            return client
        except Exception as e:
            log.warning(f"Tokeny wygasły: {e} — loguję hasłem")

    log.info("Logowanie do Garmin Connect hasłem...")
    client.login()
    log.info("Logowanie OK — tokeny zapisane w %s", TOKEN_DIR)
    return client


def _safe(data, *keys, default=None):
    for k in keys:
        if not isinstance(data, dict):
            return default
        data = data.get(k, default)
    return data


async def _upsert_metrics(conn, row: dict):
    await conn.execute("""
        INSERT INTO daily_metrics
            (date, source, avg_hr, max_hr, resting_hr, hrv, spo2, steps,
             avg_stress, max_stress, sleep_total_min, sleep_deep_min,
             sleep_light_min, sleep_rem_min, sleep_score)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (date, source) DO UPDATE SET
            avg_hr=EXCLUDED.avg_hr, max_hr=EXCLUDED.max_hr,
            resting_hr=EXCLUDED.resting_hr, hrv=EXCLUDED.hrv,
            spo2=EXCLUDED.spo2, steps=EXCLUDED.steps,
            avg_stress=EXCLUDED.avg_stress, max_stress=EXCLUDED.max_stress,
            sleep_total_min=EXCLUDED.sleep_total_min,
            sleep_deep_min=EXCLUDED.sleep_deep_min,
            sleep_light_min=EXCLUDED.sleep_light_min,
            sleep_rem_min=EXCLUDED.sleep_rem_min,
            sleep_score=EXCLUDED.sleep_score
    """,
        row["date"], row["source"],
        row.get("avg_hr"), row.get("max_hr"), row.get("resting_hr"),
        row.get("hrv"), row.get("spo2"), row.get("steps"),
        row.get("avg_stress"), row.get("max_stress"),
        row.get("sleep_total_min"), row.get("sleep_deep_min"),
        row.get("sleep_light_min"), row.get("sleep_rem_min"),
        row.get("sleep_score"),
    )


def _parse_sleep(sleep_data: dict) -> dict:
    if not sleep_data:
        return {}
    values = sleep_data.get("dailySleepDTO", {})
    return {
        "sleep_total_min":  (_safe(values, "sleepTimeSeconds",  default=0) or 0) // 60 or None,
        "sleep_deep_min":   (_safe(values, "deepSleepSeconds",  default=0) or 0) // 60 or None,
        "sleep_light_min":  (_safe(values, "lightSleepSeconds", default=0) or 0) // 60 or None,
        "sleep_rem_min":    (_safe(values, "remSleepSeconds",   default=0) or 0) // 60 or None,
        "sleep_score":      _safe(values, "sleepScores", "overall", "value"),
    }


def _parse_hrv(hrv_data) -> dict:
    if not hrv_data:
        return {}
    if isinstance(hrv_data, list) and hrv_data:
        hrv_data = hrv_data[0]
    nightly = _safe(hrv_data, "hrvSummary", "lastNight")
    weekly  = _safe(hrv_data, "hrvSummary", "weeklyAvg")
    return {"hrv": nightly or weekly}


METRIC_FIELDS = (
    "avg_hr", "max_hr", "resting_hr", "hrv", "spo2", "steps",
    "avg_stress", "max_stress", "sleep_total_min", "sleep_deep_min",
    "sleep_light_min", "sleep_rem_min", "sleep_score",
)


def has_useful_data(row: dict) -> bool:
    """Czy wiersz zawiera choć jedną realną wartość metryki (nie tylko date/source)."""
    return any(row.get(k) is not None for k in METRIC_FIELDS)


async def fetch_day_metrics(client, target_date: date) -> dict:
    """Pobiera wszystkie metryki dnia z Garmina, bez zapisu do bazy."""
    ds = target_date.isoformat()
    row = {"date": target_date, "source": "garmin"}

    try:
        hr = client.get_heart_rates(ds)
        row["resting_hr"] = _safe(hr, "restingHeartRate")
        hr_values = _safe(hr, "heartRateValues") or []
        valid_hr = [v[1] for v in hr_values if isinstance(v, list) and len(v) > 1 and v[1]]
        if valid_hr:
            row["avg_hr"] = round(sum(valid_hr) / len(valid_hr), 1)
            row["max_hr"] = max(valid_hr)
    except Exception as e:
        log.warning("[Garmin] Tętno error %s: %s", ds, e)

    try:
        stats = client.get_stats(ds)
        row["steps"] = _safe(stats, "totalSteps")
        # Klucz w odpowiedzi Garmina to "averageSpo2" (małe "o"), nie "averageSpO2".
        row["spo2"]  = stats.get("averageSpo2") or stats.get("averageSpO2")
    except Exception as e:
        log.warning("[Garmin] Stats error %s: %s", ds, e)

    try:
        stress = client.get_stress_data(ds)
        row["avg_stress"] = _safe(stress, "avgStressLevel")
        row["max_stress"] = _safe(stress, "maxStressLevel")
    except Exception as e:
        log.warning("[Garmin] Stres error %s: %s", ds, e)

    try:
        sleep = client.get_sleep_data(ds)
        row.update(_parse_sleep(sleep))
    except Exception as e:
        log.warning("[Garmin] Sen error %s: %s", ds, e)

    try:
        hrv = client.get_hrv_data(ds)
        row.update(_parse_hrv(hrv))
    except Exception as e:
        log.warning("[Garmin] HRV error %s: %s", ds, e)

    return row


async def sync_day(client, target_date: date, conn) -> bool:
    ds = target_date.isoformat()
    log.info("[Garmin] Synchronizuję: %s", ds)
    row = await fetch_day_metrics(client, target_date)
    await _upsert_metrics(conn, row)
    log.info("[Garmin] ✓ %s — HR:%s HRV:%s Stres:%s Kroki:%s",
             ds, row.get("avg_hr"), row.get("hrv"),
             row.get("avg_stress"), row.get("steps"))
    return True


async def run(days_back: int = 1):
    if not GARMIN_EMAIL or not GARMIN_PASS:
        log.error("Brak GARMIN_EMAIL lub GARMIN_PASSWORD w .env!")
        return

    try:
        client = _get_client()
    except Exception as e:
        log.error("Nie można połączyć się z Garmin Connect: %s", e)
        return

    conn = await asyncpg.connect(DB_URL)
    try:
        today = date.today()
        for i in range(days_back):
            target = today - timedelta(days=i)
            try:
                await sync_day(client, target, conn)
                await asyncio.sleep(1)
            except Exception as e:
                log.error("Błąd dnia %s: %s", target, e)
    finally:
        await conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(run(days_back=7))