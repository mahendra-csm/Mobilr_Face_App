import asyncio

import httpx
import numpy as np
from google.cloud.exceptions import Conflict

from backend import server


class FakeDoc:
    def __init__(self, data, *, exists=True):
        self._data = data
        self.exists = exists

    def to_dict(self):
        return self._data


def test_mark_attendance_allows_only_one_success_under_concurrency(monkeypatch):
    student_data = {
        "id": "student-1",
        "name": "Pilot Student",
        "roll_number": "22KH1A0001",
        "branch": "CSE",
        "year": 2,
        "face_registered": True,
    }
    face_data = {"encodings": [[0.1] * 128]}

    async def fake_get_current_student():
        return {"id": "student-1", "role": "student"}

    async def fake_fs_get_doc(doc_ref):
        if doc_ref.path.startswith("students/"):
            return FakeDoc(student_data)
        if doc_ref.path.startswith("face_encodings/"):
            return FakeDoc(face_data)
        raise AssertionError(f"Unexpected document path: {doc_ref.path}")

    created = False
    create_lock = asyncio.Lock()

    async def fake_fs_create_doc(doc_ref, data):
        nonlocal created
        await asyncio.sleep(0.01)
        async with create_lock:
            if created:
                raise Conflict("duplicate")
            created = True

    async def fake_broadcast(_message):
        return None

    monkeypatch.setattr(server, "fs_get_doc", fake_fs_get_doc)
    monkeypatch.setattr(server, "fs_create_doc", fake_fs_create_doc)
    monkeypatch.setattr(server, "decode_base64_image", lambda _: np.zeros((16, 16, 3), dtype=np.uint8))
    monkeypatch.setattr(server, "get_face_encoding", lambda *_args, **_kwargs: [0.1] * 128)
    monkeypatch.setattr(server, "compare_faces", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(server.manager, "broadcast", fake_broadcast)

    server.app.dependency_overrides[server.get_current_student] = fake_get_current_student

    payload = {
        "face_image": "data:image/jpeg;base64,ZmFrZQ==",
        "latitude": server.CAMPUS_LATITUDE,
        "longitude": server.CAMPUS_LONGITUDE,
    }

    async def exercise_concurrently():
        transport = httpx.ASGITransport(app=server.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await asyncio.gather(
                *(client.post("/api/student/mark-attendance", json=payload) for _ in range(10))
            )

    try:
        responses = asyncio.run(exercise_concurrently())
    finally:
        server.app.dependency_overrides.pop(server.get_current_student, None)

    success_responses = [response for response in responses if response.status_code == 200]
    duplicate_responses = [
        response
        for response in responses
        if response.status_code == 400 and response.json().get("detail") == "Attendance already marked for today"
    ]

    assert len(success_responses) == 1
    assert len(duplicate_responses) == 9
    assert success_responses[0].json()["attendance"]["id"].startswith("student-1_")
