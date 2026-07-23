from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db.repository import get_repository
from app.domain.models import IntakeNeedsClarification, IntakeReady
from app.services.intake import (
    confirm_treatment,
    handle_inbound_chat,
    normalize_phone,
    process_due_reminders,
    run_intake,
)
from app.services.whatsapp import send_whatsapp

router = APIRouter()


class IntakeBody(BaseModel):
    text: str = Field(min_length=3)
    phone: str | None = None


class ConfirmBody(BaseModel):
    treatment_id: str = Field(alias="treatmentId")

    model_config = {"populate_by_name": True}


class WhatsAppSimBody(BaseModel):
    from_: str = Field(alias="from")
    text: str

    model_config = {"populate_by_name": True}


@router.get("/health")
async def health() -> dict[str, Any]:
    settings = get_settings()
    repo = get_repository()
    return {
        "ok": True,
        "app": settings.app_name,
        "store": "memory" if repo.using_memory else "supabase",
        "whatsappProvider": settings.whatsapp_provider,
    }


@router.post("/intake")
async def intake(body: IntakeBody) -> dict[str, Any]:
    result = await run_intake(body.text, phone=body.phone)
    if isinstance(result, IntakeNeedsClarification):
        return result.model_dump(by_alias=True)
    if isinstance(result, IntakeReady):
        return result.model_dump(by_alias=True)
    raise HTTPException(status_code=500, detail="Resultado de intake inválido")


@router.post("/treatments/confirm")
async def treatments_confirm(body: ConfirmBody) -> dict[str, Any]:
    try:
        treatment = confirm_treatment(body.treatment_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    repo = get_repository()
    listed = next(
        (t for t in repo.list_treatments(treatment["user_id"]) if t["id"] == treatment["id"]),
        None,
    )
    dose_count = listed.get("dose_count", 0) if listed else 0
    return {"treatment": treatment, "doses": dose_count}


@router.get("/treatments")
async def treatments_list(phone: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    repo = get_repository()
    user = repo.get_or_create_user(normalize_phone(phone or settings.default_user_phone))
    return {"treatments": repo.list_treatments(user["id"])}


@router.get("/messages")
async def messages_list(phone: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    repo = get_repository()
    normalized = normalize_phone(phone or settings.default_user_phone)
    return {"phone": normalized, "messages": repo.list_messages(normalized)}


@router.post("/scheduler/tick")
@router.get("/scheduler/tick")
async def scheduler_tick() -> dict[str, Any]:
    return await process_due_reminders()


@router.get("/whatsapp/webhook")
async def whatsapp_verify(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
):
    settings = get_settings()
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        return PlainTextResponse(content=hub_challenge or "")
    raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request) -> dict[str, Any]:
    payload = await request.json()
    repo = get_repository()

    if payload.get("from") and payload.get("text"):
        phone = normalize_phone(str(payload["from"]))
        text = str(payload["text"])
        repo.add_message(phone, "inbound", text)
        reply = await handle_inbound_chat(phone, text, repo=repo)
        await send_whatsapp(phone, reply)
        return {"reply": reply}

    replies: list[str] = []
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            messages = ((change.get("value") or {}).get("messages")) or []
            for message in messages:
                text = ((message.get("text") or {}).get("body")) or ""
                if not text:
                    continue
                phone = normalize_phone(message.get("from", ""))
                repo.add_message(phone, "inbound", text)
                reply = await handle_inbound_chat(phone, text, repo=repo)
                await send_whatsapp(phone, reply)
                replies.append(reply)
    return {"ok": True, "replies": replies}
