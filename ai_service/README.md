# ExamShield AI analysis service

The service uses Python's standard library (`http.server`) and has no third-party package requirements. `simulator.py` generates 1,000 virtual candidate signals for each bounded scenario, aggregates eight regional centers, normalizes infrastructure and exam signals, computes a weighted risk with a per-scenario moving average, correlates evidence for a root-cause classification, and returns a template-backed explanation and estimated post-exam forensics report.

Run `python server.py` from this directory. The internal HTTP API listens on `127.0.0.1:8001` by default:

- `GET /health`
- `POST /analyze` with `{"scenario":"NETWORK_DEGRADATION"}`

The root `npm run dev` launcher starts this service with the frontend and Node backend. The backend proxies supported scenario requests through `AI_SERVICE_URL` (defaults to `http://127.0.0.1:8001`).

All present input is generated synthetic data. The root-cause explanation is template-backed and explainable; no external LLM or production monitoring agent is connected. For real incident analysis, send authenticated trusted telemetry into the same analysis pipeline and replace simulated downtime/recovery estimates with observed incident timestamps.
