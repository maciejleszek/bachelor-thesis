# Bachelor thesis

**Developing an IoT-based system for analyzing wearable health data and predicting psychological stress.**

The goal is to check whether — and how strongly — subjectively perceived stress (self-reported via SAM/VAS surveys)
correlates with objective physiological metrics recorded automatically by wearables (heart rate, HRV, sleep, SpO2,
device-reported stress, activity). The project explored two hardware approaches before settling on its final form:

1. **Raspberry Pi sensor node** (`sensors/`, `server/`) — an early prototype reading ambient temperature/humidity
   (DHT22), motion (PIR) and sound directly off GPIO pins, served over Flask. Abandoned in favor of using data
   already collected by commercial wearables, which give richer physiological signal than ambient sensors.
2. **Wearable device data** (Garmin Connect + Xiaomi Mi Band) — the approach that shipped. Data exploration started
   in Jupyter notebooks (`test-notebooks/`, `heat_map/`, `regression/`, `sleep_plots/`) to validate the Garmin API,
   parse the undocumented Mi Fitness export format, and prototype correlation/regression analysis and heatmaps —
   before being productionized into the app below.

## Main deliverable: Health Monitor

**[webapp/health-monitor](webapp/health-monitor)** is a full dockerized web + mobile application that:
- automatically syncs daily metrics and workouts from **Garmin Connect** (unofficial API) and imports **Xiaomi Mi
  Band** exports (Mi Fitness GDPR data export, since Mi Band has no public history API),
- collects subjective stress/mood via in-app **SAM** (Self-Assessment Manikin) and **VAS** (Visual Analogue Scale)
  surveys, plus manual blood-pressure entries,
- computes Pearson correlations between VAS stress and each physiological metric (HRV, resting HR, sleep score/
  duration, SpO2, device stress), and a training-load vs. next-day-recovery analysis,
- presents everything on a **React** web dashboard and an equivalent **React Native (Expo)** mobile app, both
  talking to the same **FastAPI** REST backend.

```
Garmin Connect API ─┐
                     ├─► sync (Python/APScheduler) ─► PostgreSQL ─► FastAPI ─┬─► React (web)
Mi Fitness (export) ─┘                                                      └─► React Native (mobile)
```

Everything runs behind `nginx` via `docker compose up -d --build` — see
[webapp/health-monitor/README.md](webapp/health-monitor/README.md) for setup, the Garmin/Mi Band sync/backfill
workflow, and [webapp/health-monitor/mobile/README.md](webapp/health-monitor/mobile/README.md) for running and
publishing the mobile client. A full write-up of the architecture and data model (for the thesis itself) is in
[webapp/health-monitor/docs/raport_aplikacja_health_monitor.md](webapp/health-monitor/docs/raport_aplikacja_health_monitor.md).

## Repository map

| Path | What it is |
|---|---|
| `webapp/health-monitor/` | **The app** — FastAPI backend, Postgres, sync jobs, React web frontend, React Native mobile client, nginx |
| `test-notebooks/` | Exploratory notebooks: Garmin API trials, Mi Band CSV parsing (HR/sleep/SpO2/steps/stress), SAM/VAS + weight data, merging everything into one dataframe |
| `heat_map/`, `regression/` | Early correlation-heatmap and regression experiments on the merged dataset, precursors to `/analysis/*` in the backend |
| `sleep_plots/` | Generated plots from early sleep-metric analysis (HRV vs. sleep score, stage breakdowns, etc.) |
| `sensors/`, `server/` | Abandoned Raspberry Pi sensor-node prototype (DHT22/PIR/sound over GPIO, Flask server) and an early standalone Garmin ingestor script, superseded by `webapp/health-monitor` |
| `json/` | Raw exported JSON samples used while reverse-engineering data formats |

## Technologies used

- **Backend**: Python, FastAPI, `asyncpg`/`databases`, APScheduler, `garminconnect`
- **Data**: PostgreSQL; Pandas, NumPy, scikit-learn, seaborn/matplotlib for the exploratory analysis
- **Frontend**: React (Create React App), Recharts
- **Mobile**: React Native, Expo, React Navigation, TanStack Query
- **Infra**: Docker / Docker Compose, nginx
- **Data formats**: JSON, XML, CSV (Garmin/Mi Band export & import formats)
