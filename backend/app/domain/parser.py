from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.config import get_settings
from app.domain.models import ParsedTreatment


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn").lower()


def _extract_medication(raw: str) -> str | None:
    patterns = [
        r"(?:tomar|tome|remedio|remédio|medicamento)\s+(?:de\s+)?([a-zA-ZÀ-ÿ0-9][\wÀ-ÿ\s-]{1,40}?)(?:\s+\d|\s+de\s+\d|\s+a\s+cada|,|\.|$)",
        r"^([a-zA-ZÀ-ÿ][\wÀ-ÿ-]{2,40})(?:\s+\d{2,4}\s*mg|\s+\d+\s*comprimido)",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw, flags=re.IGNORECASE)
        if match:
            return re.sub(r"\s+", " ", match.group(1).strip())
    parts = raw.strip().split()
    return " ".join(parts[:2]) if parts else None


def _extract_dosage(raw: str) -> str | None:
    match = re.search(
        r"(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|comprimidos?|capsulas?|cápsulas?|gotas?))",
        raw,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", match.group(1)) if match else None


def _extract_every_hours(norm: str) -> int | None:
    patterns = [
        r"(?:de\s+)?(\d{1,2})\s*(?:em|/)\s*\1",
        r"a\s+cada\s+(\d{1,2})\s*h(?:oras?)?",
        r"cada\s+(\d{1,2})\s*h(?:oras?)?",
    ]
    for pattern in patterns:
        match = re.search(pattern, norm)
        if match:
            return int(match.group(1))
    return None


def _extract_times_per_day(norm: str) -> int | None:
    match = re.search(r"(\d)\s*x\s*(?:ao|por)?\s*dia", norm)
    if match:
        return int(match.group(1))
    if "duas vezes" in norm or "2 vezes" in norm:
        return 2
    if "tres vezes" in norm or "3 vezes" in norm:
        return 3
    if any(token in norm for token in ("uma vez", "1 vez", "todo dia", "diariamente")):
        return 1
    return None


def _extract_duration_days(norm: str) -> int | None:
    match = re.search(r"(?:por|durante)\s+(\d{1,3})\s*dias?", norm)
    return int(match.group(1)) if match else None


def _extract_remind_minutes(norm: str) -> int:
    match = re.search(r"(?:avisa|avise|avisar|lembra|lembre)\s*(?:me\s*)?(?:com\s*)?(\d{1,3})\s*min", norm)
    return int(match.group(1)) if match else 15


def _extract_clock(norm: str) -> tuple[int, int] | None:
    match = re.search(r"(?:as|às|=)\s*(\d{1,2})(?::(\d{2}))?\s*h?", norm)
    if match:
        return int(match.group(1)), int(match.group(2) or "0")
    if "manha" in norm or "de manha" in norm:
        return 8, 0
    if "almoco" in norm:
        return 12, 0
    if "noite" in norm:
        return 20, 0
    return None


def _at_local_time(base: datetime, hour: int, minute: int, timezone: str) -> datetime:
    tz = ZoneInfo(timezone)
    local_base = base.astimezone(tz)
    return local_base.replace(hour=hour, minute=minute, second=0, microsecond=0)


def parse_heuristic(
    text: str,
    *,
    now: datetime | None = None,
    timezone: str | None = None,
) -> ParsedTreatment:
    settings = get_settings()
    timezone = timezone or settings.default_timezone
    tz = ZoneInfo(timezone)
    now = now or datetime.now(tz=tz)
    if now.tzinfo is None:
        now = now.replace(tzinfo=tz)
    else:
        now = now.astimezone(tz)

    raw = text.strip()
    norm = _normalize(raw)

    medication = _extract_medication(raw)
    dosage = _extract_dosage(raw)
    every_hours = _extract_every_hours(norm)
    times_per_day = None if every_hours else _extract_times_per_day(norm)
    duration_days = _extract_duration_days(norm)
    remind_before = _extract_remind_minutes(norm)
    clock = _extract_clock(norm)

    missing: list[str] = []
    assumptions: list[str] = []

    if not medication:
        missing.append("medicationName")
    if not every_hours and not times_per_day:
        missing.append("frequency")
    if not duration_days:
        missing.append("endsAt")

    if "amanha" in norm:
        hour, minute = clock or (8, 0)
        first_dose = _at_local_time(now + timedelta(days=1), hour, minute, timezone)
        if not clock:
            assumptions.append("Horário da manhã assumido como 08:00")
    elif clock:
        first_dose = _at_local_time(now, clock[0], clock[1], timezone)
        if first_dose < now:
            first_dose = _at_local_time(now + timedelta(days=1), clock[0], clock[1], timezone)
            assumptions.append("Horário de hoje já passou; primeira dose amanhã no mesmo horário")
    elif "agora" in norm:
        first_dose = now
    else:
        first_dose = now + timedelta(hours=1)
        assumptions.append("Primeira dose assumida para daqui a 1 hora")
        missing.append("firstDoseAt")

    ends_at = first_dose + timedelta(days=duration_days) if duration_days else first_dose + timedelta(days=1)
    if not duration_days:
        missing.append("endsAt")

    if "endsAt" in missing:
        question = "Por quantos dias dura o tratamento? (MVP exige data de fim.)"
    elif "frequency" in missing:
        question = "De quanto em quanto tempo você toma? Ex.: de 8 em 8 horas."
    elif "medicationName" in missing:
        question = "Qual é o nome do remédio?"
    elif missing:
        question = "Pode completar horário da primeira dose e duração em dias?"
    else:
        question = None

    unique_missing = list(dict.fromkeys(missing))
    return ParsedTreatment(
        medicationName=medication or "Remédio",
        dosage=dosage,
        frequencyEveryHours=every_hours,
        timesPerDay=times_per_day,
        anchorTimes=[] if every_hours else [first_dose.strftime("%H:%M")],
        firstDoseAt=first_dose,
        endsAt=ends_at,
        remindBeforeMinutes=remind_before,
        notes=None,
        missingFields=unique_missing,
        assumptions=assumptions,
        clarifyingQuestion=question,
        confidence=0.75 if not unique_missing else 0.35,
    )


async def parse_treatment_text(
    text: str,
    *,
    now: datetime | None = None,
    timezone: str | None = None,
) -> ParsedTreatment:
    settings = get_settings()
    timezone = timezone or settings.default_timezone

    if not settings.openai_api_key:
        return parse_heuristic(text, now=now, timezone=timezone)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        tz = ZoneInfo(timezone)
        now_local = (now or datetime.now(tz=tz)).astimezone(tz).isoformat()
        response = client.chat.completions.create(
            model=settings.openai_model,
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Você extrai tratamentos medicamentosos em português do Brasil. "
                        "Sempre exija endsAt. Não invente duração/horário. "
                        "Responda só JSON com camelCase: medicationName, dosage, "
                        "frequencyEveryHours, timesPerDay, anchorTimes, firstDoseAt, endsAt, "
                        "remindBeforeMinutes, notes, missingFields, assumptions, "
                        "clarifyingQuestion, confidence."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {"now": now_local, "timezone": timezone, "text": text},
                        ensure_ascii=False,
                    ),
                },
            ],
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        return ParsedTreatment.model_validate(data)
    except Exception:
        return parse_heuristic(text, now=now, timezone=timezone)
