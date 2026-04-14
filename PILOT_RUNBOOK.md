# SVCK Digital Pilot Runbook

This runbook is for moving SVCK Digital from code-ready status into safe day-to-day use for a small college attendance system with 150 to 200 members.

## Goal

Validate that:

- student registration works reliably on real devices
- face registration quality is good enough for repeat daily use
- attendance marking is fast enough during peak hours
- duplicate protection works under near-simultaneous submissions
- staff can recover quickly when recognition or location checks fail

## Recommended Rollout Stages

### Stage 1: Controlled Pilot

- 20 to 30 students
- 1 department or 1 section
- 3 to 5 working days
- 1 staff member assigned as pilot owner
- 1 manual fallback attendance sheet kept in parallel

### Stage 2: Expanded Pilot

- 50 to 75 students
- mixed device types
- 5 to 7 working days
- include one real peak attendance window

### Stage 3: Full Small-College Rollout

- 150 to 200 members
- only after Stage 1 and Stage 2 exit criteria are met

## Preconditions Before Pilot

- Deploy the Firebase backend with HTTPS.
- Set `ENVIRONMENT=production`.
- Set `TESTING_MODE=false`.
- Replace default admin credentials.
- Set a strong `JWT_SECRET`.
- Configure `ALLOWED_ORIGINS` for the real app/frontend only.
- Confirm Firebase Auth and Firestore production rules/settings are correct.
- Create one pilot admin account and one backup admin account.
- Keep a manual fallback attendance register ready.
- Tell students to use good lighting and remove sunglasses during face capture.

## Daily Pilot Checklist

- Backend health endpoint returns healthy.
- Admin dashboard loads correctly.
- New student registration works.
- Face registration completes with 10 images.
- Attendance marking works on at least 3 real devices before the attendance window opens.
- Support person is available during the attendance window.
- Manual fallback process is ready if camera/location issues occur.

## Success Criteria

Pilot should pass before full rollout if all of the below are mostly true:

- 95%+ of pilot students complete registration without admin intervention.
- 95%+ of valid attendance attempts succeed within 10 seconds.
- false rejects are low enough to manage operationally.
- duplicate attendance is not created for the same student/day.
- admin dashboard reflects attendance accurately.
- no critical outage occurs during the attendance window.

## Failure / Pause Criteria

Pause rollout and fix issues before expanding if any of these happen:

- repeated face mismatch for correctly registered students
- location failures for valid on-campus users
- duplicate records for the same student/day
- backend slowdown during a short peak window
- admin cannot correct or monitor attendance safely

## Live Concurrency Drill

Run this before full rollout, ideally during a non-live testing window.

### Drill A: Same User Duplicate Protection

Goal:
- confirm that repeated near-simultaneous submissions create only one attendance record

Method:
- use 1 dedicated test student account
- use 2 to 5 devices or repeated fast submissions from test clients
- trigger attendance marking nearly at the same time for the same student

Expected result:
- exactly 1 success
- all others fail with a duplicate-style response
- only 1 attendance record exists for that student for that date

### Drill B: Small Peak Window

Goal:
- confirm the server handles a short burst realistically

Method:
- use 10 to 20 pilot students over a 2 to 3 minute window
- observe response time, admin updates, and any failures

Expected result:
- no crash
- acceptable response times
- no silent failures
- admin dashboard remains usable

## Automated Regression Checks

Run these before each pilot round:

```powershell
pytest -q
cd frontend
npm run lint
npm exec tsc --noEmit
```

The repo now includes:

- `tests/test_production_hardening.py`
- `tests/test_attendance_concurrency.py`

## Recommended Pilot Notes Template

For each day, record:

- date and attendance window
- number of pilot users
- number of successful marks
- number of face mismatches
- number of location failures
- number of manual overrides
- median response time estimate
- any device-specific issues
- action items for the next day

## Final Go/No-Go Decision

Go live for all 150 to 200 members only if:

- controlled pilot succeeds
- expanded pilot succeeds
- live concurrency drill succeeds
- support staff are comfortable with the recovery flow
- admin reporting matches the recorded attendance
