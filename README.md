# SVCK Digital

SVCK Digital is a FastAPI + Expo/React Native attendance system that uses Firebase Authentication, Firestore, location validation, and face recognition for student attendance.

## Structure

- `backend/server.py`: primary production backend using Firebase Auth + Firestore
- `frontend/`: Expo mobile application
- `tests/test_production_hardening.py`: automated regression tests for the hardened security/correctness paths
- `tests/test_attendance_concurrency.py`: automated duplicate-safe concurrency regression for attendance marking
- `PILOT_RUNBOOK.md`: real-world pilot and live concurrency drill guide

## Backend Setup

1. Create `backend/.env` from `backend/.env.example`.
2. Configure:
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`
   - `ALLOWED_ORIGINS`
   - `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON`
   - `GEMINI_API_KEY` if you want the in-app assistants enabled
3. Install dependencies from `backend/requirements.txt`.
4. Run the API from `backend/server.py`.

Production notes:

- Set `ENVIRONMENT=production`
- Keep `TESTING_MODE=false`
- Use a strong `JWT_SECRET`
- Do not use wildcard CORS origins in production
- Prefer `ADMIN_PASSWORD_HASH` over a plaintext admin password

## Frontend Setup

1. Create `frontend/.env` from `frontend/.env.example`.
2. Set `EXPO_PUBLIC_BACKEND_URL` to your API base URL.
3. Configure the Firebase public client values if you are not using the bundled defaults.
4. Install frontend dependencies and start the Expo app.

Production notes:

- `frontend/app.json` includes Android and iOS bundle identifiers/permissions
- `frontend/eas.json` is configured to produce an Android App Bundle for production builds
- AI assistant requests are proxied through the backend; do not put private AI keys in the mobile app

## Verification

The current repo supports these checks:

- `pytest -q`
- `npm run lint`
- `npm exec tsc --noEmit`

## Remaining Operational Work

Code hardening is in place, but real production rollout still requires:

- HTTPS/TLS on the deployed backend
- secret provisioning in your hosting environment
- Firebase/Auth/Firestore production configuration
- mobile build signing and store release setup
- monitoring, backups, and alerting
