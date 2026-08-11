"""
Garmin Connect → PostgreSQL sync aktywności/treningów.

Codzienny tryb (kilka ostatnich aktywności) jest wołany ze scheduler.py.
Pełna historia jest uruchamiana ręcznie:
    docker compose run --rm sync python garmin_activities_sync.py --full
"""

import argparse
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import asyncpg

import garmin_sync

log = logging.getLogger("garmin_activities_sync")


def _parse_start_time(a: dict):
    """startTimeGMT to naiwny string w UTC (np. '2024-01-15 08:30:00')."""
    raw = a.get("startTimeGMT")
    if raw:
        try:
            return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    raw_local = a.get("startTimeLocal")
    if raw_local:
        try:
            return datetime.strptime(raw_local, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass
    return None

FULL_PROGRESS_FILE = Path(
    os.getenv("GARMIN_ACTIVITIES_BACKFILL_PROGRESS_FILE",
              "/data/garmin_activities_backfill_progress.json")
)
FULL_PAGE_SIZE = int(os.getenv("GARMIN_ACTIVITIES_PAGE_SIZE", "100"))
FULL_REQUEST_DELAY = float(os.getenv("GARMIN_ACTIVITIES_REQUEST_DELAY", "0.5"))
DETAILS_REQUEST_DELAY = float(os.getenv("GARMIN_ACTIVITIES_DETAILS_DELAY", "0.3"))


def _parse_activity(a: dict) -> dict:
    return {
        "garmin_activity_id": a.get("activityId"),
        "name":               a.get("activityName"),
        "sport_type":         (a.get("activityType") or {}).get("typeKey") or "unknown",
        "start_time":         _parse_start_time(a),
        "duration_sec":       a.get("duration"),
        "distance_m":         a.get("distance"),
        "calories":           a.get("calories"),
        "avg_hr":             a.get("averageHR"),
        "max_hr":             a.get("maxHR"),
        "avg_speed_mps":      a.get("averageSpeed"),
        "max_speed_mps":      a.get("maxSpeed"),
        "elevation_gain_m":   a.get("elevationGain"),
        "aerobic_te":         a.get("aerobicTrainingEffect"),
        "anaerobic_te":       a.get("anaerobicTrainingEffect"),
        "training_load":      a.get("activityTrainingLoad"),
        "raw":                json.dumps(a),
    }


async def _upsert_activity(conn, row: dict):
    if not row["garmin_activity_id"] or not row["start_time"]:
        log.warning("Pomijam aktywność bez ID lub daty startu: %s", row.get("name"))
        return
    await conn.execute("""
        INSERT INTO activities
            (garmin_activity_id, name, sport_type, start_time, duration_sec,
             distance_m, calories, avg_hr, max_hr, avg_speed_mps, max_speed_mps,
             elevation_gain_m, aerobic_te, anaerobic_te, training_load, raw)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (garmin_activity_id) DO UPDATE SET
            name=EXCLUDED.name, sport_type=EXCLUDED.sport_type,
            start_time=EXCLUDED.start_time, duration_sec=EXCLUDED.duration_sec,
            distance_m=EXCLUDED.distance_m, calories=EXCLUDED.calories,
            avg_hr=EXCLUDED.avg_hr, max_hr=EXCLUDED.max_hr,
            avg_speed_mps=EXCLUDED.avg_speed_mps, max_speed_mps=EXCLUDED.max_speed_mps,
            elevation_gain_m=EXCLUDED.elevation_gain_m, aerobic_te=EXCLUDED.aerobic_te,
            anaerobic_te=EXCLUDED.anaerobic_te, training_load=EXCLUDED.training_load,
            raw=EXCLUDED.raw
    """,
        row["garmin_activity_id"], row["name"], row["sport_type"], row["start_time"],
        row["duration_sec"], row["distance_m"], row["calories"], row["avg_hr"],
        row["max_hr"], row["avg_speed_mps"], row["max_speed_mps"],
        row["elevation_gain_m"], row["aerobic_te"], row["anaerobic_te"],
        row["training_load"], row["raw"],
    )


async def _fetch_activity_extra(client, activity_id) -> tuple:
    """Pobiera splity (per-km/lap) i strefy tętna dla jednej aktywności.
    Zwraca (splits_json_str, hr_zones_json_str) — którykolwiek może być None,
    jeśli Garmin nie ma tych danych dla tej aktywności (np. trening siłowy)."""
    splits_raw = None
    hr_zones_raw = None
    try:
        splits = client.get_activity_splits(activity_id)
        if splits:
            splits_raw = json.dumps(splits)
    except Exception as e:
        log.debug("Brak splitów dla aktywności %s: %s", activity_id, e)

    try:
        zones = client.get_activity_hr_in_timezones(activity_id)
        if zones:
            hr_zones_raw = json.dumps(zones)
    except Exception as e:
        log.debug("Brak stref HR dla aktywności %s: %s", activity_id, e)

    return splits_raw, hr_zones_raw


async def _upsert_activity_extra(conn, garmin_activity_id, splits_raw, hr_zones_raw):
    if splits_raw is None and hr_zones_raw is None:
        return
    await conn.execute("""
        UPDATE activities SET
            splits_raw   = COALESCE($2, splits_raw),
            hr_zones_raw = COALESCE($3, hr_zones_raw)
        WHERE garmin_activity_id = $1
    """, garmin_activity_id, splits_raw, hr_zones_raw)


async def run(limit: int = 20):
    """Sync ostatnich `limit` aktywności — wołane codziennie ze schedulera."""
    if not garmin_sync.GARMIN_EMAIL or not garmin_sync.GARMIN_PASS:
        log.error("Brak GARMIN_EMAIL lub GARMIN_PASSWORD w .env!")
        return

    try:
        client = garmin_sync._get_client()
    except Exception as e:
        log.error("Nie można połączyć się z Garmin Connect: %s", e)
        return

    conn = await asyncpg.connect(garmin_sync.DB_URL)
    try:
        activities = client.get_activities(0, limit)
        n = 0
        for a in activities:
            activity_id = a.get("activityId")
            await _upsert_activity(conn, _parse_activity(a))
            if activity_id:
                splits_raw, hr_zones_raw = await _fetch_activity_extra(client, activity_id)
                await _upsert_activity_extra(conn, activity_id, splits_raw, hr_zones_raw)
                await asyncio.sleep(DETAILS_REQUEST_DELAY)
            n += 1
        log.info("[Aktywności] ✓ zsynchronizowano %d aktywności (z detalami)", n)
    except Exception as e:
        log.error("[Aktywności] Błąd sync: %s", e)
    finally:
        await conn.close()


async def run_details_backfill(batch_size: int = 200):
    """Douzupełnia splity/strefy HR dla starszych aktywności, którym ich
    brakuje (np. zsynchronizowanych przez `--full` przed dodaniem tej
    funkcji, albo spoza ostatnich `limit` z codziennego sync). Wołane ręcznie:
        docker compose run --rm sync python garmin_activities_sync.py --details-backfill
    """
    if not garmin_sync.GARMIN_EMAIL or not garmin_sync.GARMIN_PASS:
        log.error("Brak GARMIN_EMAIL lub GARMIN_PASSWORD w .env!")
        return

    try:
        client = garmin_sync._get_client()
    except Exception as e:
        log.error("Nie można połączyć się z Garmin Connect: %s", e)
        return

    conn = await asyncpg.connect(garmin_sync.DB_URL)
    try:
        rows = await conn.fetch(
            """SELECT garmin_activity_id FROM activities
               WHERE splits_raw IS NULL AND hr_zones_raw IS NULL
               ORDER BY start_time DESC LIMIT $1""",
            batch_size,
        )
        log.info("[Detale/backfill] Do uzupełnienia: %d aktywności", len(rows))
        n = 0
        for r in rows:
            activity_id = r["garmin_activity_id"]
            splits_raw, hr_zones_raw = await _fetch_activity_extra(client, activity_id)
            await _upsert_activity_extra(conn, activity_id, splits_raw, hr_zones_raw)
            n += 1
            if n % 20 == 0:
                log.info("[Detale/backfill] ✓ %d/%d", n, len(rows))
            await asyncio.sleep(DETAILS_REQUEST_DELAY)
        log.info("[Detale/backfill] Zakończono. Uzupełniono %d aktywności.", n)
    finally:
        await conn.close()


def _load_full_progress() -> int:
    if FULL_PROGRESS_FILE.exists():
        try:
            return json.loads(FULL_PROGRESS_FILE.read_text()).get("next_start", 0)
        except json.JSONDecodeError:
            log.warning("Uszkodzony plik postępu %s — zaczynam od 0", FULL_PROGRESS_FILE)
    return 0


def _save_full_progress(next_start: int, total_synced: int):
    FULL_PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    FULL_PROGRESS_FILE.write_text(json.dumps({
        "next_start": next_start,
        "total_synced": total_synced,
    }))


async def run_full_history():
    """Pełna historia — pobiera WSZYSTKIE aktywności stronami. Wołane ręcznie."""
    if not garmin_sync.GARMIN_EMAIL or not garmin_sync.GARMIN_PASS:
        log.error("Brak GARMIN_EMAIL lub GARMIN_PASSWORD w .env!")
        return

    try:
        client = garmin_sync._get_client()
    except Exception as e:
        log.error("Nie można połączyć się z Garmin Connect: %s", e)
        return

    start = _load_full_progress()
    total_synced = 0
    if start:
        log.info("[Aktywności/backfill] Wznawiam od offsetu %d", start)

    conn = await asyncpg.connect(garmin_sync.DB_URL)
    try:
        try:
            total_count = client.count_activities()
            log.info("[Aktywności/backfill] Łączna liczba aktywności na koncie: %d", total_count)
        except Exception:
            total_count = None

        while True:
            try:
                page = client.get_activities(start, FULL_PAGE_SIZE)
            except Exception as e:
                log.error("[Aktywności/backfill] Błąd przy offset=%d, przerywam "
                          "(uruchom ponownie, żeby wznowić): %s", start, e)
                break

            if not page:
                log.info("[Aktywności/backfill] Pusta strona przy offset=%d — koniec historii.", start)
                break

            for a in page:
                await _upsert_activity(conn, _parse_activity(a))
                total_synced += 1

            start += len(page)
            _save_full_progress(start, total_synced)
            log.info("[Aktywności/backfill] ✓ przetworzono %d (offset teraz: %d%s)",
                      total_synced, start,
                      f"/{total_count}" if total_count else "")

            if total_count is not None and start >= total_count:
                break
            if len(page) < FULL_PAGE_SIZE:
                break

            await asyncio.sleep(FULL_REQUEST_DELAY)

        log.info("[Aktywności/backfill] Zakończono. Zsynchronizowano %d aktywności.", total_synced)
    finally:
        await conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                         format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--full", action="store_true", help="Pełna historia zamiast ostatnich aktywności")
    parser.add_argument("--details-backfill", action="store_true",
                         help="Douzupełnij splity/strefy HR dla starych aktywności bez detali")
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()

    if args.details_backfill:
        asyncio.run(run_details_backfill())
    elif args.full:
        asyncio.run(run_full_history())
    else:
        asyncio.run(run(limit=args.limit))
