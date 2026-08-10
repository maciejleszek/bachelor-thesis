"""
Mi Band (Xiaomi Health) → PostgreSQL sync

Dwa tryby działania:
  1. CLOUD — nieoficjalne Xiaomi Health API (OAuth2, działa podobnie jak Mi-Fitness-Sync)
  2. FILE  — obserwuje folder /data/miband_imports/ i automatycznie parsuje
             wrzucone pliki JSON (eksportowane ręcznie ze strony account.xiaomi.com)

Tryb wybierany przez zmienną MIBAND_MODE=cloud|file (domyślnie: file)
"""

import os
import json
import asyncio
import asyncpg
import logging
import hashlib
from datetime import date, timedelta, datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("miband_sync")

DB_URL       = os.getenv("DATABASE_URL", "postgresql://health:changeme@db:5432/health")
MIBAND_MODE  = os.getenv("MIBAND_MODE", "file")           # "cloud" or "file"
IMPORT_DIR   = Path(os.getenv("MIBAND_IMPORT_DIR", "/data/miband_imports"))
PROCESSED_DB = Path(os.getenv("MIBAND_PROCESSED_DIR", "/data/miband_imports/.processed"))

# Cloud mode
XIAOMI_USER  = os.getenv("XIAOMI_EMAIL")
XIAOMI_PASS  = os.getenv("XIAOMI_PASSWORD")
XIAOMI_REGION = os.getenv("XIAOMI_REGION", "us")   # "cn", "us", "de", "ru", "sg", "in", "i2"


# ══════════════════════════════════════════════════════════════════════════════
# TRYB FILE — parser plików JSON z account.xiaomi.com
# ══════════════════════════════════════════════════════════════════════════════

def _parse_xiaomi_json(data: dict) -> list[dict]:
    """
    Parsuje eksport JSON z account.xiaomi.com (Xiaomi Health).
    Obsługuje różne formaty: 'data', 'items', flat lista.
    Zwraca listę wierszy gotowych do zapisu do daily_metrics.
    """
    rows = []

    # Formatty eksportu Xiaomi zmieniają się z wersją apki.
    # Obsługujemy wszystkie znane warianty.
    items = (
        data.get("data")          # format 2024+
        or data.get("items")      # starszy format
        or (data if isinstance(data, list) else [])
    )

    for item in items:
        if not isinstance(item, dict):
            continue

        # Data — może być string ISO, epoch ms lub epoch s
        raw_date = item.get("date") or item.get("dateTime") or item.get("timestamp")
        if not raw_date:
            continue
        if isinstance(raw_date, (int, float)):
            ts = raw_date / 1000 if raw_date > 1e10 else raw_date
            parsed_date = datetime.fromtimestamp(ts).date()
        else:
            try:
                parsed_date = date.fromisoformat(str(raw_date)[:10])
            except ValueError:
                continue

        row = {"date": parsed_date, "source": "miband"}

        # ── Tętno ──────────────────────────────────────────────────────────
        row["avg_hr"]     = item.get("avgHeartRate") or item.get("avg_heart_rate")
        row["max_hr"]     = item.get("maxHeartRate") or item.get("max_heart_rate")
        row["resting_hr"] = item.get("restingHeartRate") or item.get("resting_heart_rate")

        # ── SpO2 ───────────────────────────────────────────────────────────
        row["spo2"] = item.get("avgSpO2") or item.get("spo2") or item.get("bloodOxygen")

        # ── Aktywność ──────────────────────────────────────────────────────
        row["steps"] = item.get("steps") or item.get("totalSteps")

        # ── Stres ──────────────────────────────────────────────────────────
        # Mi Band eksportuje stres jako "stressScore" lub "stressAvg"
        row["avg_stress"] = item.get("stressAvg") or item.get("stressScore") or item.get("avgStress")
        row["max_stress"] = item.get("stressMax") or item.get("maxStress")

        # ── Sen — Mi Band eksportuje minuty lub sekundy ────────────────────
        def _to_min(v):
            if v is None:
                return None
            v = int(v)
            return v // 60 if v > 1440 else v  # jeśli >1440 to sekundy

        row["sleep_total_min"] = _to_min(
            item.get("sleepTime") or item.get("totalSleepTime") or item.get("sleep_duration")
        )
        row["sleep_deep_min"]  = _to_min(item.get("deepSleepTime")  or item.get("deep_sleep"))
        row["sleep_light_min"] = _to_min(item.get("lightSleepTime") or item.get("light_sleep"))
        row["sleep_rem_min"]   = _to_min(item.get("remSleepTime")   or item.get("rem_sleep"))
        row["sleep_score"]     = item.get("sleepScore") or item.get("sleep_score")

        # Pomijaj rekordy bez żadnych użytecznych danych
        useful = any(row.get(k) is not None for k in
                     ["avg_hr","steps","avg_stress","sleep_total_min","spo2"])
        if useful:
            rows.append(row)

    return rows


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


def _file_hash(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


async def process_import_dir(conn) -> int:
    """Skanuje IMPORT_DIR, parsuje nowe JSON-y, zapisuje do bazy."""
    IMPORT_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DB.mkdir(parents=True, exist_ok=True)

    json_files = list(IMPORT_DIR.glob("*.json"))
    if not json_files:
        log.info("[MiBand/file] Brak nowych plików JSON w %s", IMPORT_DIR)
        return 0

    total = 0
    for fp in json_files:
        fhash = _file_hash(fp)
        marker = PROCESSED_DB / fhash

        if marker.exists():
            log.debug("[MiBand/file] Pominięto (już przetworzone): %s", fp.name)
            continue

        log.info("[MiBand/file] Przetwarzam: %s", fp.name)
        try:
            raw = json.loads(fp.read_text(encoding="utf-8"))
            rows = _parse_xiaomi_json(raw)
            for row in rows:
                await _upsert_metrics(conn, row)
            marker.touch()   # oznacz jako przetworzone
            total += len(rows)
            log.info("[MiBand/file] ✓ %s — %d rekordów", fp.name, len(rows))
        except json.JSONDecodeError as e:
            log.error("[MiBand/file] Błąd JSON w %s: %s", fp.name, e)
        except Exception as e:
            log.error("[MiBand/file] Błąd przetwarzania %s: %s", fp.name, e)

    return total


# ══════════════════════════════════════════════════════════════════════════════
# TRYB CLOUD — Xiaomi Health API (nieoficjalne)
# ══════════════════════════════════════════════════════════════════════════════

REGION_URLS = {
    "cn": "https://api-user.health.mi.com",
    "us": "https://api-user.health.mi.com",
    "de": "https://api-user.health.mi.com",
    "sg": "https://api-user.health.mi.com",
}

TOKEN_PATH = Path("/data/miband_tokens/token.json")


async def _cloud_login() -> dict:
    """
    Loguje się do Xiaomi Health Cloud przez OAuth2.
    Wymaga jednorazowego potwierdzenia w przeglądarce (podobnie jak Mi-Fitness-Sync).
    Tokeny zapisywane są lokalnie.
    """
    import httpx

    if TOKEN_PATH.exists():
        tokens = json.loads(TOKEN_PATH.read_text())
        log.info("[MiBand/cloud] Załadowano tokeny z dysku")
        return tokens

    # ── OAuth2 flow przez Xiaomi SSO ──────────────────────────────────────
    log.info("[MiBand/cloud] Logowanie do Xiaomi Health Cloud...")
    log.warning(
        "[MiBand/cloud] Ważne: Xiaomi wymaga potwierdzenia w przeglądarce.\n"
        "  Otwórz: https://account.xiaomi.com i zaloguj się,\n"
        "  a następnie ustaw zmienne XIAOMI_EMAIL i XIAOMI_PASSWORD w .env."
    )

    # Minimalny flow — bardziej rozbudowany wymaga Playwright jak Garmin
    # Tu implementujemy podstawowe logowanie przez API
    async with httpx.AsyncClient(timeout=30) as client:
        # Krok 1: Uzyskaj token sesji Xiaomi
        login_resp = await client.post(
            "https://account.xiaomi.com/pass/serviceLoginAuth2",
            data={
                "_json": "true",
                "user": XIAOMI_USER,
                "password": XIAOMI_PASS,
                "sid": "health_xiaomi",
                "callback": "https://api-user.health.mi.com/app/v2/user/login/mi",
            },
            headers={
                "User-Agent": "MiFitness/5.11.2 (iPhone; iOS 17.0; Scale/3.00)",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            follow_redirects=True,
        )
        result = login_resp.json()
        if result.get("code") != 0:
            raise RuntimeError(f"Logowanie Xiaomi nieudane: {result}")

        tokens = {
            "service_token": result.get("serviceToken"),
            "user_id": result.get("userId"),
            "device_id": result.get("deviceId"),
        }
        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_PATH.write_text(json.dumps(tokens))
        log.info("[MiBand/cloud] ✓ Zalogowano, tokeny zapisane")
        return tokens


async def _fetch_health_data(tokens: dict, target_date: date) -> dict:
    """Pobiera dane zdrowotne z Xiaomi Health API dla danego dnia."""
    import httpx

    ds = target_date.strftime("%Y%m%d")
    base_url = REGION_URLS.get(XIAOMI_REGION, REGION_URLS["us"])

    headers = {
        "User-Agent": "MiFitness/5.11.2 (iPhone; iOS 17.0; Scale/3.00)",
        "x-xiaomi-userid": str(tokens["user_id"]),
        "serviceToken": tokens["service_token"],
    }

    async with httpx.AsyncClient(timeout=20, headers=headers) as client:
        # Dzienny agregat danych zdrowotnych
        resp = await client.get(
            f"{base_url}/app/v2/home/summary",
            params={"date": ds, "lang": "en_US"},
        )
        resp.raise_for_status()
        return resp.json()


async def cloud_sync_day(tokens: dict, target_date: date, conn) -> bool:
    try:
        data = await _fetch_health_data(tokens, target_date)
        rows = _parse_xiaomi_json(data)
        for row in rows:
            await _upsert_metrics(conn, row)
        log.info(f"[MiBand/cloud] ✓ {target_date} — {len(rows)} rekordów")
        return True
    except Exception as e:
        log.error(f"[MiBand/cloud] Błąd {target_date}: {e}")
        return False


# ══════════════════════════════════════════════════════════════════════════════
# GŁÓWNA FUNKCJA
# ══════════════════════════════════════════════════════════════════════════════

async def run(days_back: int = 1):
    conn = await asyncpg.connect(DB_URL)
    try:
        if MIBAND_MODE == "cloud":
            log.info("[MiBand] Tryb: CLOUD")
            try:
                tokens = await _cloud_login()
            except Exception as e:
                log.error(f"[MiBand/cloud] Błąd logowania — przełącz na tryb FILE: {e}")
                return
            for i in range(days_back):
                target = date.today() - timedelta(days=i)
                await cloud_sync_day(tokens, target, conn)
                await asyncio.sleep(1)
        else:
            log.info("[MiBand] Tryb: FILE (obserwacja folderu %s)", IMPORT_DIR)
            n = await process_import_dir(conn)
            log.info("[MiBand] Przetworzone rekordy: %d", n)
    finally:
        await conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(run(days_back=7))
