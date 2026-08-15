"""
Scheduler dzienny — uruchamia sync o 23:45 każdego dnia.
Garmin: pełny sync dnia bieżącego (23:45) + lekki sync co 2h w ciągu dnia.
Mi Band: skanowanie folderu imports (tryb file) lub cloud.

Dodatkowe uruchomienia:
  - startup: sync ostatnich 3 dni (wyrównanie po ewentualnym przestoju)
  - co 2h: sync Garmin (dziś) i Mi Band (żeby dane były szybko widoczne)
"""

import asyncio
import logging
import os
import asyncpg
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import garmin_activities_sync
import garmin_sync
import miband_sync

load_dotenv()
log = logging.getLogger("scheduler")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s  %(message)s",
)


async def _record_sync(source: str, ok: bool, error: str = None):
    """Zapisuje wynik syncu do sync_log — do wyświetlenia w UI ("ostatni refresh")."""
    try:
        conn = await asyncpg.connect(garmin_sync.DB_URL)
        try:
            await conn.execute(
                """
                INSERT INTO sync_log (source, last_attempt_at, last_success_at, last_error)
                VALUES ($1, NOW(), CASE WHEN $2 THEN NOW() ELSE NULL END, $3)
                ON CONFLICT (source) DO UPDATE SET
                    last_attempt_at = NOW(),
                    last_success_at = CASE WHEN $2 THEN NOW() ELSE sync_log.last_success_at END,
                    last_error = $3
                """,
                source, ok, error,
            )
        finally:
            await conn.close()
    except Exception as e:
        log.warning("Nie udało się zapisać sync_log dla %s: %s", source, e)


async def job_garmin_daily():
    """Sync Garmin — ostatnie 2 dni (na wypadek opóźnionego uploadu danych)."""
    log.info("=== START: Garmin sync ===")
    try:
        await garmin_sync.run(days_back=2)
        await _record_sync("garmin_metrics", True)
    except Exception as e:
        log.error(f"Garmin sync nieudany: {e}")
        await _record_sync("garmin_metrics", False, str(e))
    log.info("=== KONIEC: Garmin sync ===")


async def job_activities():
    """Sync ostatnich aktywności/treningów z Garmina."""
    log.info("=== START: Aktywności sync ===")
    try:
        await garmin_activities_sync.run(limit=20)
        await _record_sync("garmin_activities", True)
    except Exception as e:
        log.error(f"Aktywności sync nieudany: {e}")
        await _record_sync("garmin_activities", False, str(e))
    log.info("=== KONIEC: Aktywności sync ===")


async def job_garmin_periodic():
    """Lekki sync Garmina w ciągu dnia — tylko dziś, żeby dane szybciej się odświeżały."""
    log.info("=== START: Garmin sync (co 2h) ===")
    try:
        await garmin_sync.run(days_back=1)
        await _record_sync("garmin_metrics", True)
    except Exception as e:
        log.error(f"Garmin sync (co 2h) nieudany: {e}")
        await _record_sync("garmin_metrics", False, str(e))
    try:
        await garmin_activities_sync.run(limit=5)
        await _record_sync("garmin_activities", True)
    except Exception as e:
        log.error(f"Aktywności sync (co 2h) nieudany: {e}")
        await _record_sync("garmin_activities", False, str(e))
    log.info("=== KONIEC: Garmin sync (co 2h) ===")


async def job_miband():
    """Sync Mi Band — tryb zdefiniowany w MIBAND_MODE."""
    log.info("=== START: Mi Band sync ===")
    try:
        await miband_sync.run(days_back=2)
        await _record_sync("miband", True)
    except Exception as e:
        log.error(f"Mi Band sync nieudany: {e}")
        await _record_sync("miband", False, str(e))
    log.info("=== KONIEC: Mi Band sync ===")


async def startup_sync():
    """Wyrównujący sync przy starcie — ostatnie 7 dni."""
    log.info("=== STARTUP SYNC (7 dni) ===")
    try:
        await garmin_sync.run(days_back=7)
        await _record_sync("garmin_metrics", True)
    except Exception as e:
        log.error(f"Startup Garmin sync błąd: {e}")
        await _record_sync("garmin_metrics", False, str(e))
    try:
        await miband_sync.run(days_back=7)
        await _record_sync("miband", True)
    except Exception as e:
        log.error(f"Startup Mi Band sync błąd: {e}")
        await _record_sync("miband", False, str(e))
    try:
        await garmin_activities_sync.run(limit=20)
        await _record_sync("garmin_activities", True)
    except Exception as e:
        log.error(f"Startup aktywności sync błąd: {e}")
        await _record_sync("garmin_activities", False, str(e))
    log.info("=== STARTUP SYNC ZAKOŃCZONY ===")


async def main():
    scheduler = AsyncIOScheduler(timezone="Europe/Warsaw")

    # Garmin — raz dziennie o 23:45
    scheduler.add_job(
        job_garmin_daily,
        CronTrigger(hour=23, minute=45),
        id="garmin_daily",
        name="Garmin codzienny sync",
        replace_existing=True,
    )

    # Aktywności Garmin — raz dziennie o 23:47
    scheduler.add_job(
        job_activities,
        CronTrigger(hour=23, minute=47),
        id="activities_daily",
        name="Aktywności Garmin codzienny sync",
        replace_existing=True,
    )

    # Mi Band (file watcher) — co 2h + o 23:50
    scheduler.add_job(
        job_miband,
        CronTrigger(minute=0, hour="*/2"),
        id="miband_periodic",
        name="Mi Band file watcher",
        replace_existing=True,
    )
    scheduler.add_job(
        job_miband,
        CronTrigger(hour=23, minute=50),
        id="miband_daily",
        name="Mi Band codzienny sync",
        replace_existing=True,
    )

    # Garmin — lekki sync co 2h (offset 15 min od Mi Band, żeby nie zbiegać się w czasie)
    scheduler.add_job(
        job_garmin_periodic,
        CronTrigger(minute=15, hour="*/2"),
        id="garmin_periodic",
        name="Garmin sync co 2h",
        replace_existing=True,
    )

    scheduler.start()
    log.info("Scheduler uruchomiony")
    log.info("Garmin sync: co 2h (pełny o 23:45)")
    log.info("Mi Band sync: co 2h + 23:50")

    # Sync przy starcie (w tle, żeby nie blokować startu schedulera)
    asyncio.create_task(startup_sync())

    # Trzymaj procesor przy życiu
    try:
        while True:
            await asyncio.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        log.info("Scheduler zatrzymany")


if __name__ == "__main__":
    asyncio.run(main())
