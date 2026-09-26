# ExamShield backend

This is the Express, Mongoose, and Socket.IO backend for ExamShield. It includes exam/student/session/telemetry/incident/recovery/audit schemas, state transition rules, a transaction-backed hash chain, JWT RBAC guards, and a bounded in-memory continuity queue with retry support.

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
- `GET /api/exams/:examId`
- `POST /api/exams/:examId/state`
- `POST /api/exams/:examId/telemetry`
- `POST /api/exams/:examId/sessions`
- `POST /api/student-sessions/:sessionId/submissions`
- `GET /api/exams/:examId/sessions`
- `GET /api/audit/verify?stream=platform`

State, telemetry, session-start, and recovery events are recorded with their related writes in MongoDB transactions. This requires MongoDB replica set or sharded-cluster transaction support. The in-memory queue preserves accepted submissions during an infrastructure outage, then flushes them into `RecoveryItem` and the student session after MongoDB reconnects. Queue contents are process-local and cannot survive a backend process restart while MongoDB is unavailable.
