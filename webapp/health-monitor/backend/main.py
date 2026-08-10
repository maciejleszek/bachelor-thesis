from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
import databases
import os

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
    days: int = Query(30, le=365)
):
    where = "WHERE date >= CURRENT_DATE - :days"
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
        "SELECT * FROM blood_pressure WHERE measured_at >= NOW() - INTERVAL ':days days' ORDER BY measured_at DESC",
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
