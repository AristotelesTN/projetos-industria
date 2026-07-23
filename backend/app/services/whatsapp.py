from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings
from app.db.repository import get_repository

logger = logging.getLogger(__name__)


async def send_whatsapp(phone: str, body: str) -> dict[str, Any]:
    settings = get_settings()
    repo = get_repository()
    provider = settings.whatsapp_provider.lower()

    if provider == "meta":
        if not settings.whatsapp_token or not settings.whatsapp_phone_number_id:
            result = {"ok": False, "provider": "meta", "error": "credenciais ausentes"}
            repo.add_message(phone, "outbound", body, result)
            return result

        url = f"https://graph.facebook.com/v21.0/{settings.whatsapp_phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": body},
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {settings.whatsapp_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        data = response.json()
        ok = response.is_success
        result = {
            "ok": ok,
            "provider": "meta",
            "id": (data.get("messages") or [{}])[0].get("id"),
            "error": None if ok else data.get("error", {}).get("message"),
            "response": data,
        }
        repo.add_message(phone, "outbound", body, result)
        return result

    logger.info("[whatsapp:mock] → %s\n%s", phone, body)
    result = {"ok": True, "provider": "mock", "id": f"mock_{phone}"}
    repo.add_message(phone, "outbound", body, result)
    return result
