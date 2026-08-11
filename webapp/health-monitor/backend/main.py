from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
import databases
import json
import os
import statistics

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://health:changeme@localhost:5432/health")
database = databases.Database(DATABASE_URL)

app = FastAPI(title="Health Monitor API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

# ── Schemas ──────────────────────────────────────────────────────────────────

class SurveyIn(BaseModel):
    date: Optional[date] = None
    sam_valence: Optional[int] = None
    sam_arousal: Optional[int] = None
    sam_dominance: Optional[int] = None
    vas_stress: Optional[int] = None
    notes: Optional[str] = None

class BloodPressureIn(BaseModel):
    sys: int
    dia: int
    pulse: Optional[int] = None
    notes: Optional[str] = None

class MetricsIn(BaseModel):
    date: date
    source: str
    avg_hr: Optional[float] = None
    max_hr: Optional[float] = None
    resting_hr: Optional[float] = None
    hrv: Optional[float] = None
    spo2: Optional[float] = None
    steps: Optional[int] = None
    avg_stress: Optional[float] = None
    max_stress: Optional[float] = None
    sleep_total_min: Optional[int] = None
    sleep_deep_min: Optional[int] = None
    sleep_light_min: Optional[int] = None
    sleep_rem_min: Optional[int] = None
    sleep_score: Optional[float] = None

# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}

# ── Surveys ──────────────────────────────────────────────────────────────────

@app.get("/surveys")
async def get_surveys(limit: int = Query(30, le=365)):
    rows = await database.fetch_all(
        "SELECT * FROM surveys ORDER BY date DESC, created_at DESC LIMIT :limit",
        {"limit": limit}
    )
    return [dict(r) for r in rows]

@app.post("/surveys", status_code=201)
async def create_survey(body: SurveyIn):
    row_id = await database.execute(
        """INSERT INTO surveys (date, sam_valence, sam_arousal, sam_dominance, vas_stress, notes)
           VALUES (:date, :sam_valence, :sam_arousal, :sam_dominance, :vas_stress, :notes)
           RETURNING id""",
        {
            "date": body.date or date.today(),
            "sam_valence": body.sam_valence,
            "sam_arousal": body.sam_arousal,
            "sam_dominance": body.sam_dominance,
            "vas_stress": body.vas_stress,
            "notes": body.notes,
        }
    )
    return {"id": row_id}

@app.delete("/surveys/{survey_id}", status_code=204)
async def delete_survey(survey_id: int):
    await database.execute("DELETE FROM surveys WHERE id = :id", {"id": survey_id})

# ── Daily metrics ─────────────────────────────────────────────────────────────

@app.get("/metrics")
async def get_metrics(
    source: Optional[str] = None,
    days: int = Query(30, le=3650)
):
    where = "WHERE date >= CURRENT_DATE - CAST(:days AS INTEGER)"
    params: dict = {"days": days}
    if source:
        where += " AND source = :source"
        params["source"] = source
    rows = await database.fetch_all(
        f"SELECT * FROM daily_metrics {where} ORDER BY date DESC",
        params
    )
    return [dict(r) for r in rows]

@app.post("/metrics", status_code=201)
async def upsert_metrics(body: MetricsIn):
    row_id = await database.execute(
        """INSERT INTO daily_metrics
               (date, source, avg_hr, max_hr, resting_hr, hrv, spo2, steps,
                avg_stress, max_stress, sleep_total_min, sleep_deep_min,
                sleep_light_min, sleep_rem_min, sleep_score)
           VALUES
               (:date, :source, :avg_hr, :max_hr, :resting_hr, :hrv, :spo2, :steps,
                :avg_stress, :max_stress, :sleep_total_min, :sleep_deep_min,
                :sleep_light_min, :sleep_rem_min, :sleep_score)
           ON CONFLICT (date, source) DO UPDATE SET
               avg_hr=EXCLUDED.avg_hr, max_hr=EXCLUDED.max_hr,
               resting_hr=EXCLUDED.resting_hr, hrv=EXCLUDED.hrv,
               spo2=EXCLUDED.spo2, steps=EXCLUDED.steps,
               avg_stress=EXCLUDED.avg_stress, max_stress=EXCLUDED.max_stress,
               sleep_total_min=EXCLUDED.sleep_total_min, sleep_deep_min=EXCLUDED.sleep_deep_min,
               sleep_light_min=EXCLUDED.sleep_light_min, sleep_rem_min=EXCLUDED.sleep_rem_min,
               sleep_score=EXCLUDED.sleep_score
           RETURNING id""",
        body.model_dump()
    )
    return {"id": row_id}

# ── Blood pressure ────────────────────────────────────────────────────────────

@app.get("/blood-pressure")
async def get_bp(days: int = Query(30, le=365)):
    rows = await database.fetch_all(
        "SELECT * FROM blood_pressure WHERE measured_at >= NOW() - make_interval(days => :days) ORDER BY measured_at DESC",
        {"days": days}
    )
    return [dict(r) for r in rows]

@app.post("/blood-pressure", status_code=201)
async def create_bp(body: BloodPressureIn):
    row_id = await database.execute(
        "INSERT INTO blood_pressure (sys, dia, pulse, notes) VALUES (:sys, :dia, :pulse, :notes) RETURNING id",
        body.model_dump()
    )
    return {"id": row_id}

# ── Activities (sport) ────────────────────────────────────────────────────────

@app.get("/activities")
async def get_activities(
    sport_type: Optional[str] = None,
    days: Optional[int] = Query(None, le=3650),
    limit: int = Query(200, le=2000),
):
    where = "WHERE 1=1"
    params: dict = {"limit": limit}
    if days is not None:
        where += " AND start_time >= NOW() - make_interval(days => :days)"
        params["days"] = days
    if sport_type:
        where += " AND sport_type = :sport_type"
        params["sport_type"] = sport_type
    rows = await database.fetch_all(
        f"""SELECT id, garmin_activity_id, source, name, sport_type, start_time,
                   duration_sec, distance_m, calories, avg_hr, max_hr,
                   avg_speed_mps, max_speed_mps, elevation_gain_m,
                   aerobic_te, anaerobic_te, training_load
            FROM activities {where}
            ORDER BY start_time DESC LIMIT :limit""",
        params
    )
    return [dict(r) for r in rows]

@app.get("/activities/sport-types")
async def get_sport_types():
    rows = await database.fetch_all(
        "SELECT DISTINCT sport_type FROM activities ORDER BY sport_type"
    )
    return [r["sport_type"] for r in rows]

@app.get("/activities/summary")
async def get_activities_summary(days: Optional[int] = Query(None, le=3650)):
    where = "WHERE 1=1"
    params: dict = {}
    if days is not None:
        where += " AND start_time >= NOW() - make_interval(days => :days)"
        params["days"] = days

    by_sport = await database.fetch_all(
        f"""SELECT sport_type,
                   COUNT(*) AS sessions,
                   SUM(distance_m) AS total_distance_m,
                   SUM(duration_sec) AS total_duration_sec,
                   SUM(calories) AS total_calories,
                   AVG(avg_hr) AS avg_hr
            FROM activities {where}
            GROUP BY sport_type
            ORDER BY total_duration_sec DESC NULLS LAST""",
        params
    )
    weekly = await database.fetch_all(
        f"""SELECT date_trunc('week', start_time)::date AS week,
                   sport_type,
                   SUM(distance_m) AS total_distance_m,
                   SUM(duration_sec) AS total_duration_sec
            FROM activities {where}
            GROUP BY week, sport_type
            ORDER BY week ASC""",
        params
    )
    return {
        "by_sport": [dict(r) for r in by_sport],
        "weekly": [dict(r) for r in weekly],
    }

RECORD_METRICS = {
    "distance_m":    "distance_m",
    "duration_sec":  "duration_sec",
    "calories":      "calories",
    "avg_speed_mps": "avg_speed_mps",
}

@app.get("/activities/records")
async def get_activity_records(sport_type: Optional[str] = None):
    """Rekordy życiowe (całą historię, niezależnie od filtra dni) —
    najdłuższy dystans, najdłuższy czas, najwięcej kalorii, najszybsze tempo."""
    where = "WHERE 1=1"
    params: dict = {}
    if sport_type:
        where += " AND sport_type = :sport_type"
        params["sport_type"] = sport_type

    records = {}
    for key, column in RECORD_METRICS.items():
        row = await database.fetch_one(
            f"""SELECT id, name, sport_type, start_time, {column} AS value
                FROM activities {where} AND {column} IS NOT NULL AND {column} > 0
                ORDER BY {column} DESC LIMIT 1""",
            params
        )
        records[key] = dict(row) if row else None

    total = await database.fetch_one(
        f"SELECT COUNT(*) AS n FROM activities {where}", params
    )
    return {"records": records, "total_activities": total["n"]}

def _as_json(value):
    """Kolumny JSONB wracają z asyncpg jako string — parsujemy defensywnie."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return None


def _parse_splits(raw) -> list:
    """Garmin nie dokumentuje formalnie kształtu odpowiedzi get_activity_splits —
    próbujemy kilku znanych wariantów kluczy i defensywnie wyciągamy pola."""
    data = _as_json(raw)
    if data is None:
        return []
    laps = data.get("lapDTOs") or data.get("laps") or data.get("splits") \
        if isinstance(data, dict) else data
    if not isinstance(laps, list):
        return []
    result = []
    for i, lap in enumerate(laps, start=1):
        if not isinstance(lap, dict):
            continue
        result.append({
            "index":            lap.get("lapIndex") or lap.get("index") or i,
            "distance_m":       lap.get("distance"),
            "duration_sec":     lap.get("duration") or lap.get("movingDuration"),
            "avg_hr":           lap.get("averageHR"),
            "max_hr":           lap.get("maxHR"),
            "avg_speed_mps":    lap.get("averageSpeed"),
            "elevation_gain_m": lap.get("elevationGain"),
        })
    return result


def _parse_hr_zones(raw) -> list:
    data = _as_json(raw)
    if not isinstance(data, list):
        return []
    result = []
    for zone in data:
        if not isinstance(zone, dict):
            continue
        result.append({
            "zone":    zone.get("zoneNumber") or zone.get("zone"),
            "seconds": zone.get("secsInZone") or zone.get("seconds"),
            "low_bpm": zone.get("zoneLowBoundary") or zone.get("lowBoundary"),
        })
    return result


@app.get("/activities/{activity_id}/details")
async def get_activity_details(activity_id: int):
    row = await database.fetch_one(
        "SELECT id, splits_raw, hr_zones_raw FROM activities WHERE id = :id",
        {"id": activity_id}
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono aktywności")
    splits = _parse_splits(row["splits_raw"])
    hr_zones = _parse_hr_zones(row["hr_zones_raw"])
    return {
        "splits": splits,
        "hr_zones": hr_zones,
        "has_details": bool(splits or hr_zones),
    }

# ── Summary for dashboard ─────────────────────────────────────────────────────

@app.get("/summary")
async def get_summary():
    """Last 7 days aggregated summary for dashboard cards."""
    metrics = await database.fetch_all(
        """SELECT date, source, avg_hr, resting_hr, hrv, spo2, steps,
                  avg_stress, sleep_total_min, sleep_deep_min, sleep_score
           FROM daily_metrics
           WHERE date >= CURRENT_DATE - 7
           ORDER BY date DESC""",
    )
    surveys = await database.fetch_all(
        "SELECT * FROM surveys WHERE date >= CURRENT_DATE - 7 ORDER BY date DESC"
    )
    bp = await database.fetch_all(
        "SELECT * FROM blood_pressure WHERE measured_at >= NOW() - INTERVAL '7 days' ORDER BY measured_at DESC LIMIT 10"
    )
    return {
        "metrics": [dict(r) for r in metrics],
        "surveys": [dict(r) for r in surveys],
        "blood_pressure": [dict(r) for r in bp],
    }

# ── Analiza korelacji stresu z metrykami fizjologicznymi ───────────────────────

CORRELATION_METRICS = ("hrv", "resting_hr", "sleep_score", "sleep_total_min", "spo2", "avg_stress")

@app.get("/analysis/correlation")
async def get_correlation(days: Optional[int] = Query(None, le=3650)):
    """Zestawia dzienny stres z ankiet (VAS) z metrykami Garmina tego samego
    dnia (HRV, tętno spoczynkowe, sen, SpO2, stres wg Garmina) i liczy
    korelację Pearsona każdej z nich z odczuwanym stresem."""
    where = ""
    params: dict = {}
    if days is not None:
        where = "WHERE sd.date >= CURRENT_DATE - CAST(:days AS INTEGER)"
        params["days"] = days

    rows = await database.fetch_all(
        f"""WITH survey_daily AS (
                SELECT date, AVG(vas_stress) AS vas_stress,
                       AVG(sam_valence) AS sam_valence, AVG(sam_arousal) AS sam_arousal
                FROM surveys
                WHERE vas_stress IS NOT NULL
                GROUP BY date
            ),
            metrics_daily AS (
                -- Jeśli dzień ma dane z obu opasek, preferujemy Garmina
                -- (więcej metryk, np. HRV), w innym wypadku bierzemy Mi Band.
                SELECT DISTINCT ON (date)
                       date, hrv, resting_hr, sleep_score, sleep_total_min,
                       spo2, avg_stress
                FROM daily_metrics
                ORDER BY date, (source = 'garmin') DESC
            )
            SELECT sd.date, sd.vas_stress, sd.sam_valence, sd.sam_arousal,
                   md.hrv, md.resting_hr, md.sleep_score, md.sleep_total_min,
                   md.spo2, md.avg_stress
            FROM survey_daily sd
            JOIN metrics_daily md ON md.date = sd.date
            {where}
            ORDER BY sd.date ASC""",
        params
    )
    pairs = [dict(r) for r in rows]

    correlations = {}
    for metric in CORRELATION_METRICS:
        xs, ys = [], []
        for p in pairs:
            if p["vas_stress"] is not None and p[metric] is not None:
                xs.append(float(p["vas_stress"]))
                ys.append(float(p[metric]))
        r = None
        if len(xs) >= 3 and len(set(xs)) > 1 and len(set(ys)) > 1:
            try:
                r = round(statistics.correlation(xs, ys), 3)
            except statistics.StatisticsError:
                r = None
        correlations[metric] = {"r": r, "n": len(xs)}

    return {"pairs": pairs, "correlations": correlations}

# ── Trening a regeneracja następnego dnia ───────────────────────────────────────

RECOVERY_METRICS = ("next_sleep_score", "next_resting_hr", "next_hrv", "next_vas_stress")

@app.get("/analysis/training-recovery")
async def get_training_recovery(days: Optional[int] = Query(None, le=3650)):
    """Zestawia dzienne obciążenie treningowe (suma training_load z aktywności
    danego dnia) z metrykami regeneracji NASTĘPNEGO dnia — sleep score, tętno
    spoczynkowe, HRV, subiektywny stres z ankiety — i liczy korelację Pearsona."""
    where = ""
    params: dict = {}
    if days is not None:
        where = "WHERE dt.date >= CURRENT_DATE - CAST(:days AS INTEGER)"
        params["days"] = days

    rows = await database.fetch_all(
        f"""WITH daily_training AS (
                SELECT start_time::date AS date,
                       SUM(training_load) AS training_load,
                       COUNT(*) AS sessions
                FROM activities
                GROUP BY date
            ),
            metrics_daily AS (
                SELECT DISTINCT ON (date)
                       date, sleep_score, resting_hr, hrv
                FROM daily_metrics
                ORDER BY date, (source = 'garmin') DESC
            ),
            survey_daily AS (
                SELECT date, AVG(vas_stress) AS vas_stress
                FROM surveys
                WHERE vas_stress IS NOT NULL
                GROUP BY date
            )
            SELECT dt.date AS training_date, dt.training_load, dt.sessions,
                   md.sleep_score AS next_sleep_score,
                   md.resting_hr AS next_resting_hr,
                   md.hrv AS next_hrv,
                   sv.vas_stress AS next_vas_stress
            FROM daily_training dt
            LEFT JOIN metrics_daily md ON md.date = dt.date + 1
            LEFT JOIN survey_daily sv ON sv.date = dt.date + 1
            {where}
            ORDER BY dt.date ASC""",
        params
    )
    pairs = [dict(r) for r in rows]

    correlations = {}
    for metric in RECOVERY_METRICS:
        xs, ys = [], []
        for p in pairs:
            if p["training_load"] is not None and p[metric] is not None:
                xs.append(float(p["training_load"]))
                ys.append(float(p[metric]))
        r = None
        if len(xs) >= 3 and len(set(xs)) > 1 and len(set(ys)) > 1:
            try:
                r = round(statistics.correlation(xs, ys), 3)
            except statistics.StatisticsError:
                r = None
        correlations[metric] = {"r": r, "n": len(xs)}

    return {"pairs": pairs, "correlations": correlations}
