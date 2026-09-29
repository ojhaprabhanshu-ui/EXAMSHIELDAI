# ExamShield backend

This is the Express, Mongoose, and Socket.IO backend for ExamShield. It includes exam/student/session/telemetry/incident/recovery/audit schemas, state transition rules, a transaction-backed hash chain, JWT RBAC guards, and a bounded in-memory continuity queue with retry support.

The root development launcher also starts the Python analysis service in `../ai_service`. The public, bounded demo endpoints `POST /api/ai/simulate` and `GET /api/ai/reports` bridge only predefined synthetic scenarios; if MongoDB is ready, each run, its aggregate telemetry signals, and an incident record are persisted together. Those demo routes do not expose live exam or student records. Set `AI_SERVICE_URL` to override the Python service URL.

## Current startup behavior

Run `npm run dev` from this folder to start HTTP and Socket.IO on port 4000. Configure `MONGODB_URI` and `JWT_SECRET` in the local environment file; the backend does not provide fallback credentials. `GET /api/health` reports `503` until MongoDB is configured. Protected routes fail closed until a valid JWT is provided. Tokens must use HS256, issuer `examshield`, audience `examshield-api`, a Mongo ObjectId subject, and one of the supported roles. `JWT_SECRET` must be at least 32 bytes.

Create the first staff login by running `npm run create-user` in this folder. The command prompts for an email, display name, role, and a hidden password, then stores only a bcrypt password hash. The sign-in screen at the frontend uses `POST /api/auth/login`; access tokens are held in memory and are not persisted in browser storage. Admins and Examiners can create an exam from the Command Center when none exist.

HTTP and Socket.IO allow the local Vite origins on ports 5173 and 4173. Socket.IO requires the same JWT claims and permits Admin, Examiner, and Moderator roles to join existing exam rooms. Risk and state events emit after durable persistence. Production deployments will need their frontend origin added to the allowlist.

## Implemented routes

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/exams`
- `POST /api/exams`
- `GET /api/exams/:examId/dashboard`
- `GET /api/exams/:examId/remediation/latest`
- `POST /api/exams/:examId/remediation`
- `GET /api/exams/:examId`
- `POST /api/exams/:examId/state`
- `POST /api/exams/:examId/telemetry`
- `POST /api/exams/:examId/sessions`
- `POST /api/student-sessions/:sessionId/submissions`
- `GET /api/exams/:examId/sessions`
- `GET /api/audit/verify?stream=platform`

State, telemetry, session-start, and recovery events are recorded with their related writes in MongoDB transactions. This requires MongoDB replica set or sharded-cluster transaction support. The in-memory queue preserves accepted submissions during an infrastructure outage, then flushes them into `RecoveryItem` and the student session after MongoDB reconnects. Queue contents are process-local and cannot survive a backend process restart while MongoDB is unavailable.

### Local MongoDB setup on Windows

If exam creation reports that database transactions are not enabled, the local MongoDB service is running as a standalone server. Run PowerShell as Administrator, add these two lines under the top-level settings in `C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg`, and restart the `MongoDB` service:

```yaml
replication:
  replSetName: rs0
```

Then initialize the single-node replica set once:

```powershell
mongosh "mongodb://127.0.0.1:27017/?directConnection=true" --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

Add `replicaSet=rs0` to the backend `MONGODB_URI` query string (for example, `mongodb://127.0.0.1:27017/examshield?replicaSet=rs0`) and restart the backend. Existing database files are retained when enabling replica set mode.

## Automatic remediation

The backend selects playbooks only from the fixed registry in `src/services/auto-remediation.js`; model output is treated as diagnosis/evidence and never as an executable action. Every action, verification, rollback, success, failure, and escalation is appended to the audit hash chain. Remediation runs are stored in `RemediationRun` and broadcast as `remediation:updated`. Health verification uses the latest stored telemetry and blocks recovery while health thresholds fail or queue work remains. Demo health baselines are trusted only when the supplied simulation run ID matches a persisted simulated analysis with the same diagnosis.

Actions that would require control of external network appliances, databases, or identity providers currently set application-level policy flags and preserve continuity; this backend does not execute infrastructure shell commands or claim that it changed external services. Unresolved checks roll back temporary policy flags and retain continuity/session protection while emitting `ADMIN_ESCALATION`.
