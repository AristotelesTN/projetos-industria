from __future__ import annotations

from datetime import datetime, timedelta

from app.domain.models import ParsedTreatment, PlannedDose


def build_dose_plan(parsed: ParsedTreatment) -> list[PlannedDose]:
    first = parsed.first_dose_at
    ends = parsed.ends_at
    if ends <= first:
        raise ValueError("A data de fim precisa ser depois da primeira dose.")

    remind_before = timedelta(minutes=parsed.remind_before_minutes)
    doses: list[PlannedDose] = []

    def push(scheduled_at: datetime) -> None:
        if scheduled_at > ends:
            return
        if any(d.scheduled_at == scheduled_at for d in doses):
            return
        doses.append(
            PlannedDose(
                scheduled_at=scheduled_at,
                remind_at=scheduled_at - remind_before,
            )
        )

    if parsed.frequency_every_hours:
        cursor = first
        while cursor <= ends and len(doses) < 500:
            push(cursor)
            cursor = cursor + timedelta(hours=parsed.frequency_every_hours)
        return sorted(doses, key=lambda d: d.scheduled_at)

    anchors = parsed.anchor_times or [first.strftime("%H:%M")]
    times_per_day = parsed.times_per_day or len(anchors)
    daily = anchors[: max(times_per_day, 1)]

    day_offset = 0
    while len(doses) < 500 and day_offset <= 366:
        added = 0
        for hhmm in daily:
            hour, minute = map(int, hhmm.split(":"))
            scheduled = first.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(
                days=day_offset
            )
            if scheduled < first:
                continue
            if scheduled > ends:
                return sorted(doses, key=lambda d: d.scheduled_at)
            push(scheduled)
            added += 1
        if added == 0 and day_offset > 0:
            break
        day_offset += 1

    return sorted(doses, key=lambda d: d.scheduled_at)


def estimate_dose_count(parsed: ParsedTreatment) -> int:
    return len(build_dose_plan(parsed))
