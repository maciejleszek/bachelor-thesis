-- Ankiety SAM + VAS
CREATE TABLE IF NOT EXISTS surveys (
    id          SERIAL PRIMARY KEY,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- SAM (0–9)
    sam_valence    SMALLINT CHECK (sam_valence BETWEEN 0 AND 9),
    sam_arousal    SMALLINT CHECK (sam_arousal BETWEEN 0 AND 9),
    sam_dominance  SMALLINT CHECK (sam_dominance BETWEEN 0 AND 9),
    -- VAS (0–100)
    vas_stress     SMALLINT CHECK (vas_stress BETWEEN 0 AND 100),
    notes       TEXT
);

-- Dane z opasek (dzienne agregaty)
CREATE TABLE IF NOT EXISTS daily_metrics (
    id               SERIAL PRIMARY KEY,
    date             DATE NOT NULL,
    source           VARCHAR(32) NOT NULL,   -- 'miband' | 'garmin'
    avg_hr           NUMERIC(5,1),
    max_hr           NUMERIC(5,1),
    resting_hr       NUMERIC(5,1),
    hrv              NUMERIC(6,2),
    spo2             NUMERIC(4,1),
    steps            INTEGER,
    avg_stress       NUMERIC(5,1),
    max_stress       NUMERIC(5,1),
    sleep_total_min  INTEGER,
    sleep_deep_min   INTEGER,
    sleep_light_min  INTEGER,
    sleep_rem_min    INTEGER,
    sleep_score      NUMERIC(4,1),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (date, source)
);

-- Ciśnienie
CREATE TABLE IF NOT EXISTS blood_pressure (
    id         SERIAL PRIMARY KEY,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sys        SMALLINT,
    dia        SMALLINT,
    pulse      SMALLINT,
    notes      TEXT
);

-- Dane środowiskowe (RPi + BME280)
CREATE TABLE IF NOT EXISTS environment (
    id          SERIAL PRIMARY KEY,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    temperature NUMERIC(4,1),
    humidity    NUMERIC(4,1),
    co2_ppm     INTEGER
);
