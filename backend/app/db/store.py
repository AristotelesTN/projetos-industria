from __future__ import annotations

import json
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from threading import Lock
from typing import Any


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _id() -> str:
    return uuid.uuid4().hex


class MemoryStore:
    """In-memory repository used when Supabase credentials are absent."""

    def __init__(self) -> None:
        self._lock = Lock()
        self.users: dict[str, dict[str, Any]] = {}
        self.treatments: dict[str, dict[str, Any]] = {}
        self.doses: dict[str, dict[str, Any]] = {}
        self.sessions: dict[str, dict[str, Any]] = {}
        self.messages: list[dict[str, Any]] = []

    def get_or_create_user(self, phone: str, name: str | None = None, timezone_name: str = "America/Sao_Paulo") -> dict[str, Any]:
        with self._lock:
            for user in self.users.values():
                if user["phone"] == phone:
                    return deepcopy(user)
            user = {
                "id": _id(),
                "phone": phone,
                "name": name,
                "timezone": timezone_name,
                "created_at": _now().isoformat(),
            }
            self.users[user["id"]] = user
            return deepcopy(user)

    def upsert_session(self, user_id: str, phone: str, state: str, draft_json: str | None) -> dict[str, Any]:
        with self._lock:
            existing = next((s for s in self.sessions.values() if s["phone"] == phone), None)
            if existing:
                existing.update(
                    {
                        "state": state,
                        "draft_json": draft_json,
                        "updated_at": _now().isoformat(),
                    }
                )
                return deepcopy(existing)
            session = {
                "id": _id(),
                "user_id": user_id,
                "phone": phone,
                "state": state,
                "draft_json": draft_json,
                "updated_at": _now().isoformat(),
            }
            self.sessions[session["id"]] = session
            return deepcopy(session)

    def get_session_by_phone(self, phone: str) -> dict[str, Any] | None:
        with self._lock:
            for session in self.sessions.values():
                if session["phone"] == phone:
                    return deepcopy(session)
        return None

    def create_treatment(self, data: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            treatment = {
                "id": _id(),
                "created_at": _now().isoformat(),
                "updated_at": _now().isoformat(),
                **data,
            }
            self.treatments[treatment["id"]] = treatment
            return deepcopy(treatment)

    def get_treatment(self, treatment_id: str) -> dict[str, Any] | None:
        with self._lock:
            treatment = self.treatments.get(treatment_id)
            return deepcopy(treatment) if treatment else None

    def update_treatment(self, treatment_id: str, **fields: Any) -> dict[str, Any]:
        with self._lock:
            treatment = self.treatments[treatment_id]
            treatment.update(fields)
            treatment["updated_at"] = _now().isoformat()
            return deepcopy(treatment)

    def replace_doses(self, treatment_id: str, doses: list[dict[str, Any]]) -> list[dict[str, Any]]:
        with self._lock:
            for dose_id, dose in list(self.doses.items()):
                if dose["treatment_id"] == treatment_id:
                    del self.doses[dose_id]
            created: list[dict[str, Any]] = []
            for item in doses:
                dose = {"id": _id(), "created_at": _now().isoformat(), **item}
                self.doses[dose["id"]] = dose
                created.append(deepcopy(dose))
            return created

    def list_treatments(self, user_id: str) -> list[dict[str, Any]]:
        with self._lock:
            items = [deepcopy(t) for t in self.treatments.values() if t["user_id"] == user_id]
            items.sort(key=lambda t: t["created_at"], reverse=True)
            for treatment in items:
                treatment_doses = [
                    deepcopy(d)
                    for d in self.doses.values()
                    if d["treatment_id"] == treatment["id"]
                ]
                treatment_doses.sort(key=lambda d: d["scheduled_at"])
                treatment["doses"] = treatment_doses[:8]
                treatment["dose_count"] = sum(
                    1 for d in self.doses.values() if d["treatment_id"] == treatment["id"]
                )
            return items

    def find_due_doses(self, now: datetime) -> list[dict[str, Any]]:
        with self._lock:
            due: list[dict[str, Any]] = []
            now_iso = now.astimezone(timezone.utc).isoformat()
            for dose in self.doses.values():
                if dose["status"] != "pending":
                    continue
                treatment = self.treatments.get(dose["treatment_id"])
                if not treatment or treatment["status"] != "active":
                    continue
                if dose["remind_at"] <= now_iso:
                    item = deepcopy(dose)
                    item["treatment"] = deepcopy(treatment)
                    item["user"] = deepcopy(self.users[treatment["user_id"]])
                    due.append(item)
            due.sort(key=lambda d: d["remind_at"])
            return due[:50]

    def update_dose(self, dose_id: str, **fields: Any) -> dict[str, Any]:
        with self._lock:
            dose = self.doses[dose_id]
            dose.update(fields)
            return deepcopy(dose)

    def find_open_dose_for_user(self, user_id: str) -> dict[str, Any] | None:
        with self._lock:
            candidates = []
            for dose in self.doses.values():
                treatment = self.treatments.get(dose["treatment_id"])
                if not treatment or treatment["user_id"] != user_id or treatment["status"] != "active":
                    continue
                if dose["status"] in {"reminded", "pending"}:
                    candidates.append(deepcopy(dose))
            candidates.sort(key=lambda d: d["scheduled_at"])
            return candidates[0] if candidates else None

    def list_active_treatments_past_end(self, now: datetime) -> list[dict[str, Any]]:
        with self._lock:
            now_iso = now.astimezone(timezone.utc).isoformat()
            result = []
            for treatment in self.treatments.values():
                if treatment["status"] != "active":
                    continue
                if treatment["ends_at"] <= now_iso:
                    item = deepcopy(treatment)
                    item["user"] = deepcopy(self.users[treatment["user_id"]])
                    item["doses"] = [
                        deepcopy(d)
                        for d in self.doses.values()
                        if d["treatment_id"] == treatment["id"]
                    ]
                    result.append(item)
            return result

    def add_message(self, phone: str, direction: str, body: str, meta: dict[str, Any] | None = None) -> dict[str, Any]:
        with self._lock:
            message = {
                "id": _id(),
                "phone": phone,
                "direction": direction,
                "body": body,
                "meta_json": json.dumps(meta or {}),
                "created_at": _now().isoformat(),
            }
            self.messages.append(message)
            return deepcopy(message)

    def list_messages(self, phone: str, limit: int = 30) -> list[dict[str, Any]]:
        with self._lock:
            items = [deepcopy(m) for m in self.messages if m["phone"] == phone]
            items.sort(key=lambda m: m["created_at"], reverse=True)
            return items[:limit]


_STORE: MemoryStore | None = None


def get_memory_store() -> MemoryStore:
    global _STORE
    if _STORE is None:
        _STORE = MemoryStore()
    return _STORE


def reset_memory_store() -> MemoryStore:
    global _STORE
    _STORE = MemoryStore()
    return _STORE
