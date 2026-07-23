from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import get_settings
from app.db.repository import Repository, get_repository
from app.domain.doses import build_dose_plan, estimate_dose_count
from app.domain.models import IntakeNeedsClarification, IntakeReady, ParsedTreatment
from app.domain.parser import parse_treatment_text
from app.services.whatsapp import send_whatsapp


def normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone)


def _iso(value: datetime | str) -> str:
    if isinstance(value, str):
        return value
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def format_draft_summary(draft: dict[str, Any]) -> str:
    freq = (
        f"a cada {draft['frequencyEveryHours']}h"
        if draft.get("frequencyEveryHours")
        else f"{draft.get('timesPerDay')}x ao dia"
    )
    lines = [
        f"*{draft['medicationName']}*{f' ({draft['dosage']})' if draft.get('dosage') else ''}",
        f"Frequência: {freq}",
        f"Primeira dose: {draft['firstDoseAt']}",
        f"Fim: {draft['endsAt']}",
        f"Aviso: {draft['remindBeforeMinutes']} min antes",
    ]
    if draft.get("estimatedDoses"):
        lines.append(f"Doses previstas: {draft['estimatedDoses']}")
    if draft.get("assumptions"):
        lines.append(f"Premissas: {'; '.join(draft['assumptions'])}")
    lines.append("Responda CONFIRMAR para ativar ou CANCELAR.")
    return "\n".join(lines)


async def run_intake(
    text: str,
    *,
    phone: str | None = None,
    repo: Repository | None = None,
) -> IntakeNeedsClarification | IntakeReady:
    settings = get_settings()
    repo = repo or get_repository()
    phone = normalize_phone(phone or settings.default_user_phone)
    user = repo.get_or_create_user(phone)
    parsed = await parse_treatment_text(text, timezone=user.get("timezone") or settings.default_timezone)
    parsed_dump = parsed.model_dump(by_alias=True, mode="json")

    if parsed.missing_fields or parsed.clarifying_question or parsed.confidence < 0.55:
        question = parsed.clarifying_question or (
            "Pode detalhar frequência, horário da primeira dose e duração em dias?"
        )
        repo.upsert_session(
            user["id"],
            phone,
            "awaiting_clarification",
            json.dumps({"sourceText": text, "partial": parsed_dump}, ensure_ascii=False),
        )
        return IntakeNeedsClarification(
            question=question,
            partial={**parsed_dump, "sourceText": text},
        )

    estimated = estimate_dose_count(parsed)
    draft = {**parsed_dump, "sourceText": text, "estimatedDoses": estimated}
    treatment = repo.create_treatment(
        {
            "user_id": user["id"],
            "medication_name": parsed.medication_name,
            "dosage": parsed.dosage,
            "frequency_every_hours": parsed.frequency_every_hours,
            "times_per_day": parsed.times_per_day,
            "anchor_times": parsed.anchor_times,
            "first_dose_at": _iso(parsed.first_dose_at),
            "ends_at": _iso(parsed.ends_at),
            "remind_before_minutes": parsed.remind_before_minutes,
            "notes": parsed.notes,
            "source_text": text,
            "parsed_json": parsed_dump,
            "status": "draft",
        }
    )
    repo.upsert_session(
        user["id"],
        phone,
        "awaiting_confirm",
        json.dumps({"treatmentId": treatment["id"], "draft": draft}, ensure_ascii=False),
    )
    return IntakeReady(draft_id=treatment["id"], draft=draft)


def confirm_treatment(treatment_id: str, repo: Repository | None = None) -> dict[str, Any]:
    repo = repo or get_repository()
    treatment = repo.get_treatment(treatment_id)
    if not treatment:
        raise ValueError("Tratamento não encontrado")
    if treatment["status"] == "active":
        return treatment

    parsed_raw = treatment["parsed_json"]
    if isinstance(parsed_raw, str):
        parsed_raw = json.loads(parsed_raw)
    parsed = ParsedTreatment.model_validate(parsed_raw)
    plan = build_dose_plan(parsed)
    repo.replace_doses(
        treatment_id,
        [
            {
                "treatment_id": treatment_id,
                "scheduled_at": _iso(dose.scheduled_at),
                "remind_at": _iso(dose.remind_at),
                "status": "pending",
                "snooze_count": 0,
            }
            for dose in plan
        ],
    )
    updated = repo.update_treatment(treatment_id, status="active")
    _idle_sessions_for_user(repo, treatment["user_id"])
    return updated


def _idle_sessions_for_user(repo: Repository, user_id: str) -> None:
    if repo.using_memory:
        for session in list(repo.memory.sessions.values()):
            if session["user_id"] == user_id:
                repo.upsert_session(user_id, session["phone"], "idle", None)



def cancel_draft(treatment_id: str, repo: Repository | None = None) -> dict[str, Any]:
    repo = repo or get_repository()
    return repo.update_treatment(treatment_id, status="cancelled")


async def handle_inbound_chat(phone: str, body: str, repo: Repository | None = None) -> str:
    repo = repo or get_repository()
    phone = normalize_phone(phone)
    user = repo.get_or_create_user(phone)
    text = body.strip()
    lower = text.lower()
    session = repo.get_session_by_phone(phone)

    if lower in {"confirmar", "confirm", "ok", "sim"}:
        if session and session.get("state") == "awaiting_confirm" and session.get("draft_json"):
            data = json.loads(session["draft_json"])
            confirm_treatment(data["treatmentId"], repo=repo)
            return "Tratamento ativado. Vou te avisar no WhatsApp antes de cada dose até o fim."
        return "Não há rascunho aguardando confirmação. Descreva o tratamento."

    if lower in {"cancelar", "cancel", "nao", "não"}:
        if session and session.get("draft_json"):
            try:
                data = json.loads(session["draft_json"])
                if data.get("treatmentId"):
                    cancel_draft(data["treatmentId"], repo=repo)
            except Exception:
                pass
        repo.upsert_session(user["id"], phone, "idle", None)
        return "Rascunho cancelado. Pode descrever outro tratamento quando quiser."

    if lower in {"tomei", "1"}:
        dose = repo.find_open_dose_for_user(user["id"])
        if not dose:
            return "Não encontrei dose pendente para marcar."
        repo.update_dose(dose["id"], status="taken", taken_at=_iso(datetime.now(tz=timezone.utc)))
        return "Anotado: dose tomada. Bom tratamento!"

    if lower in {"adiar", "2"}:
        dose = repo.find_open_dose_for_user(user["id"])
        if not dose:
            return "Não encontrei dose para adiar."
        snooze_until = datetime.now(tz=timezone.utc) + timedelta(minutes=15)
        repo.update_dose(
            dose["id"],
            status="pending",
            remind_at=_iso(snooze_until),
            snooze_count=int(dose.get("snooze_count") or 0) + 1,
        )
        return "Ok, te lembro de novo em 15 minutos."

    intake_text = text
    if session and session.get("state") == "awaiting_clarification" and session.get("draft_json"):
        try:
            prev = json.loads(session["draft_json"])
            if prev.get("sourceText"):
                intake_text = f"{prev['sourceText']}\n{text}"
        except Exception:
            pass

    result = await run_intake(intake_text, phone=phone, repo=repo)
    if isinstance(result, IntakeNeedsClarification):
        return f"Entendi parcialmente. {result.question}"
    return f"Montei o tratamento:\n\n{format_draft_summary(result.draft)}"


async def process_due_reminders(now: datetime | None = None, repo: Repository | None = None) -> dict[str, Any]:
    repo = repo or get_repository()
    now = now or datetime.now(tz=timezone.utc)
    due = repo.find_due_doses(now)
    results = []

    for dose in due:
        treatment = dose["treatment"]
        user = dose["user"]
        scheduled = dose["scheduled_at"]
        body = (
            f"Lembrete DoseCerta: em breve tome {treatment['medication_name']}"
            f"{f' ({treatment['dosage']})' if treatment.get('dosage') else ''}.\n"
            f"Horário previsto: {scheduled}.\n"
            f"Aviso com {treatment['remind_before_minutes']} min de antecedência.\n"
            "Responda TOMEI ou ADIAR."
        )
        sent = await send_whatsapp(user["phone"], body)
        if sent.get("ok"):
            repo.update_dose(dose["id"], status="reminded", reminded_at=_iso(now))
            results.append({"doseId": dose["id"], "ok": True})
        else:
            results.append({"doseId": dose["id"], "ok": False, "error": sent.get("error")})

    for treatment in repo.list_active_treatments_past_end(now):
        repo.update_treatment(treatment["id"], status="completed")
        await send_whatsapp(
            treatment["user"]["phone"],
            f"Tratamento de {treatment['medication_name']} concluído. Cuide-se!",
        )

    return {"processed": len(results), "results": results}
