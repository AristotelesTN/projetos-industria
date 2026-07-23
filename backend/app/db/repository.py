from __future__ import annotations

from datetime import datetime
from typing import Any

from app.config import get_settings
from app.db.store import get_memory_store
from app.db.supabase_client import get_supabase_client


class Repository:
    """Facade that prefers Supabase and falls back to memory for local MVP."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.memory = get_memory_store()
        self.supabase = get_supabase_client() if self.settings.supabase_configured and not self.settings.use_memory_store else None

    @property
    def using_memory(self) -> bool:
        return self.supabase is None

    def get_or_create_user(self, phone: str, name: str | None = None) -> dict[str, Any]:
        if self.using_memory:
            return self.memory.get_or_create_user(phone, name, self.settings.default_timezone)

        assert self.supabase is not None
        existing = self.supabase.table("profiles").select("*").eq("phone", phone).limit(1).execute()
        if existing.data:
            return existing.data[0]
        created = (
            self.supabase.table("profiles")
            .insert(
                {
                    "phone": phone,
                    "name": name,
                    "timezone": self.settings.default_timezone,
                }
            )
            .execute()
        )
        return created.data[0]

    def upsert_session(self, user_id: str, phone: str, state: str, draft_json: str | None) -> dict[str, Any]:
        if self.using_memory:
            return self.memory.upsert_session(user_id, phone, state, draft_json)
        assert self.supabase is not None
        payload = {
            "user_id": user_id,
            "phone": phone,
            "state": state,
            "draft_json": draft_json,
        }
        result = self.supabase.table("chat_sessions").upsert(payload, on_conflict="phone").execute()
        return result.data[0]

    def get_session_by_phone(self, phone: str) -> dict[str, Any] | None:
        if self.using_memory:
            return self.memory.get_session_by_phone(phone)
        assert self.supabase is not None
        result = self.supabase.table("chat_sessions").select("*").eq("phone", phone).limit(1).execute()
        return result.data[0] if result.data else None

    def create_treatment(self, data: dict[str, Any]) -> dict[str, Any]:
        if self.using_memory:
            return self.memory.create_treatment(data)
        assert self.supabase is not None
        result = self.supabase.table("treatments").insert(data).execute()
        return result.data[0]

    def get_treatment(self, treatment_id: str) -> dict[str, Any] | None:
        if self.using_memory:
            return self.memory.get_treatment(treatment_id)
        assert self.supabase is not None
        result = self.supabase.table("treatments").select("*").eq("id", treatment_id).limit(1).execute()
        return result.data[0] if result.data else None

    def update_treatment(self, treatment_id: str, **fields: Any) -> dict[str, Any]:
        if self.using_memory:
            return self.memory.update_treatment(treatment_id, **fields)
        assert self.supabase is not None
        result = self.supabase.table("treatments").update(fields).eq("id", treatment_id).execute()
        return result.data[0]

    def replace_doses(self, treatment_id: str, doses: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if self.using_memory:
            return self.memory.replace_doses(treatment_id, doses)
        assert self.supabase is not None
        self.supabase.table("doses").delete().eq("treatment_id", treatment_id).execute()
        if not doses:
            return []
        result = self.supabase.table("doses").insert(doses).execute()
        return result.data

    def list_treatments(self, user_id: str) -> list[dict[str, Any]]:
        if self.using_memory:
            return self.memory.list_treatments(user_id)
        assert self.supabase is not None
        result = (
            self.supabase.table("treatments")
            .select("*, doses(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        items = []
        for row in result.data or []:
            doses = sorted(row.get("doses") or [], key=lambda d: d["scheduled_at"])
            row["doses"] = doses[:8]
            row["dose_count"] = len(doses)
            items.append(row)
        return items

    def find_due_doses(self, now: datetime) -> list[dict[str, Any]]:
        if self.using_memory:
            return self.memory.find_due_doses(now)
        assert self.supabase is not None
        result = (
            self.supabase.table("doses")
            .select("*, treatments(*, profiles(*))")
            .eq("status", "pending")
            .lte("remind_at", now.isoformat())
            .limit(50)
            .execute()
        )
        due = []
        for row in result.data or []:
            treatment = row.get("treatments")
            if not treatment or treatment.get("status") != "active":
                continue
            row["treatment"] = treatment
            row["user"] = treatment.get("profiles")
            due.append(row)
        return due

    def update_dose(self, dose_id: str, **fields: Any) -> dict[str, Any]:
        if self.using_memory:
            return self.memory.update_dose(dose_id, **fields)
        assert self.supabase is not None
        result = self.supabase.table("doses").update(fields).eq("id", dose_id).execute()
        return result.data[0]

    def find_open_dose_for_user(self, user_id: str) -> dict[str, Any] | None:
        if self.using_memory:
            return self.memory.find_open_dose_for_user(user_id)
        assert self.supabase is not None
        treatments = (
            self.supabase.table("treatments")
            .select("id")
            .eq("user_id", user_id)
            .eq("status", "active")
            .execute()
        )
        ids = [t["id"] for t in treatments.data or []]
        if not ids:
            return None
        result = (
            self.supabase.table("doses")
            .select("*")
            .in_("treatment_id", ids)
            .in_("status", ["pending", "reminded"])
            .order("scheduled_at")
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def list_active_treatments_past_end(self, now: datetime) -> list[dict[str, Any]]:
        if self.using_memory:
            return self.memory.list_active_treatments_past_end(now)
        assert self.supabase is not None
        result = (
            self.supabase.table("treatments")
            .select("*, profiles(*), doses(*)")
            .eq("status", "active")
            .lte("ends_at", now.isoformat())
            .execute()
        )
        items = []
        for row in result.data or []:
            row["user"] = row.get("profiles")
            items.append(row)
        return items

    def add_message(self, phone: str, direction: str, body: str, meta: dict[str, Any] | None = None) -> dict[str, Any]:
        if self.using_memory:
            return self.memory.add_message(phone, direction, body, meta)
        assert self.supabase is not None
        payload = {
            "phone": phone,
            "direction": direction,
            "body": body,
            "meta_json": meta or {},
        }
        result = self.supabase.table("message_logs").insert(payload).execute()
        return result.data[0]

    def list_messages(self, phone: str, limit: int = 30) -> list[dict[str, Any]]:
        if self.using_memory:
            return self.memory.list_messages(phone, limit)
        assert self.supabase is not None
        result = (
            self.supabase.table("message_logs")
            .select("*")
            .eq("phone", phone)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []


def get_repository() -> Repository:
    return Repository()
