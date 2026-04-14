import asyncio

import numpy as np
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from google.cloud.exceptions import Conflict

from backend import server


class FakeDoc:
    def __init__(self, data, *, exists=True):
        self._data = data
        self.exists = exists

    def to_dict(self):
        return self._data


def test_create_token_contains_expiry_and_issuer():
    token = server.create_token({"role": "admin", "email": "admin@svck.edu.in"}, expires_minutes=5)
    payload = server.decode_token(token)

    assert payload["role"] == "admin"
    assert payload["iss"] == server.JWT_ISSUER
    assert "exp" in payload


def test_legacy_student_login_endpoint_no_longer_leaks_student_profile():
    result = asyncio.run(
        server.login_student(server.StudentLogin(roll_number="22KH1A0001", password="wrong-password"))
    )

    assert result["message"] == "Use Firebase client SDK for authentication"
    assert result["email"] == "22kh1a0001@svck.edu.in"
    assert "student" not in result
    assert "token" not in result


def test_admin_websocket_requires_token():
    client = TestClient(server.app)

    with pytest.raises(Exception):
        with client.websocket_connect("/api/ws/admin"):
            pass


def test_admin_websocket_accepts_valid_admin_token(monkeypatch):
    async def fake_get_current_user_from_token(token: str):
        assert token == "valid-admin-token"
        return {"role": "admin", "email": "admin@svck.edu.in"}

    monkeypatch.setattr(server, "get_current_user_from_token", fake_get_current_user_from_token)

    client = TestClient(server.app)
    with client.websocket_connect("/api/ws/admin?token=valid-admin-token"):
        assert True


def test_mark_attendance_converts_conflict_to_duplicate(monkeypatch):
    docs = [
        FakeDoc(
            {
                "id": "student-1",
                "name": "Test Student",
                "roll_number": "22KH1A0001",
                "branch": "CSE",
                "year": 2,
                "face_registered": True,
            }
        ),
        FakeDoc({"encodings": [[0.1] * 128]}),
    ]

    async def fake_fs_query(query):
        return []

    async def fake_fs_get_doc(doc_ref):
        return docs.pop(0)

    async def fake_fs_create_doc(doc_ref, data):
        raise Conflict("duplicate")

    async def fake_broadcast(message):
        return None

    monkeypatch.setattr(server, "fs_query", fake_fs_query)
    monkeypatch.setattr(server, "fs_get_doc", fake_fs_get_doc)
    monkeypatch.setattr(server, "fs_create_doc", fake_fs_create_doc)
    monkeypatch.setattr(server, "decode_base64_image", lambda _: np.zeros((10, 10, 3), dtype=np.uint8))
    monkeypatch.setattr(server, "get_face_encoding", lambda *_args, **_kwargs: [0.1] * 128)
    monkeypatch.setattr(server, "compare_faces", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(server.manager, "broadcast", fake_broadcast)

    request = server.AttendanceRequest(
        face_image="data:image/jpeg;base64,ZmFrZQ==",
        latitude=server.CAMPUS_LATITUDE,
        longitude=server.CAMPUS_LONGITUDE,
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(server.mark_attendance(request, user={"id": "student-1", "role": "student"}))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Attendance already marked for today"


def test_student_assistant_requires_server_side_configuration(monkeypatch):
    original_api_key = server.GEMINI_API_KEY
    monkeypatch.setattr(server, "GEMINI_API_KEY", None)

    request = server.StudentAssistantRequest(message="Help me study DBMS", history=[])

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            server.student_assistant_chat(
                request,
                user={"id": "student-1", "role": "student", "name": "Test Student", "roll_number": "22KH1A0001"},
            )
        )

    assert exc_info.value.status_code == 503
    assert "not configured" in exc_info.value.detail

    monkeypatch.setattr(server, "GEMINI_API_KEY", original_api_key)
