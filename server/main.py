import os
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Float
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from typing import List

# --- 1. KONFIGURACJA BAZY DANYCH ---
DATABASE_URL = "sqlite:///./garmin_live.db"


class Base(DeclarativeBase):
    pass


class SleepEntry(Base):
    __tablename__ = "sleep_data"
    date = Column(String, primary_key=True, index=True)
    duration_min = Column(Float)
    deep_min = Column(Float)
    rem_min = Column(Float)
    light_min = Column(Float)
    awake_min = Column(Float)


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Tworzenie tabeli
Base.metadata.create_all(bind=engine)

# --- 2. KONFIGURACJA API ---
app = FastAPI(title="Garmin Data Server")


class SleepDataSchema(BaseModel):
    date: str
    duration_min: float
    deep_min: float
    rem_min: float
    light_min: float
    awake_min: float


# Funkcja pomocnicza do eksportu bazy do CSV (dla Tableau)
def export_to_csv():
    try:
        db = SessionLocal()
        # Wyciągamy wszystko z bazy do DataFrame
        df = pd.read_sql("SELECT * FROM sleep_data", engine)
        # Zapisujemy do CSV w tym samym folderze
        df.to_csv("garmin_data.csv", index=False)
        db.close()
        print("📊 Plik garmin_data.csv został zaktualizowany.")
    except Exception as e:
        print(f"❌ Błąd eksportu CSV: {e}")


# --- 3. ENDPOINTY ---

@app.post("/ingest")
async def ingest_data(data: SleepDataSchema):
    db = SessionLocal()
    try:
        existing = db.query(SleepEntry).filter(SleepEntry.date == data.date).first()

        if existing:
            for key, value in data.model_dump().items():
                setattr(existing, key, value)
        else:
            new_entry = SleepEntry(**data.model_dump())
            db.add(new_entry)

        db.commit()

        # --- KLUCZOWY MOMENT ---
        # Po każdym zapisie do SQL, odświeżamy plik CSV dla Tableau
        export_to_csv()

        return {"status": "success", "date": data.date}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.get("/data")
async def get_all_data():
    db = SessionLocal()
    records = db.query(SleepEntry).order_by(SleepEntry.date.desc()).all()
    db.close()
    return records


@app.get("/")
async def root():
    return {"message": "Server is running", "csv_export": "Check garmin_data.csv in folder"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)