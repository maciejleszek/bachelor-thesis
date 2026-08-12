# Bachelor thesis

Developing an IoT-based system for analyzing wearable health data and predicting psychological stress using machine
learning models.

The main deliverable is **Health Monitor** — see [webapp/health-monitor](webapp/health-monitor) for the app itself
(setup, architecture, sync scripts) and [webapp/health-monitor/mobile](webapp/health-monitor/mobile) for the React
Native client.

Technologies used:
- Python (FastAPI, asyncio, APScheduler)
- PostgreSQL
- React (web) / React Native + Expo (mobile)
- Docker / Docker Compose, nginx
- Pandas, NumPy
- JSON, XML, CSV (device data import/export formats)
