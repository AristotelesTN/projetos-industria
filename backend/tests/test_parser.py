from datetime import datetime
from zoneinfo import ZoneInfo

from app.domain.doses import build_dose_plan
from app.domain.parser import parse_heuristic


def test_parse_amoxicilina_8h():
    now = datetime(2026, 7, 23, 10, 0, tzinfo=ZoneInfo("America/Sao_Paulo"))
    parsed = parse_heuristic(
        "Amoxicilina 500mg de 8 em 8 horas por 7 dias, começando hoje às 14h. Me avisa 15 minutos antes.",
        now=now,
        timezone="America/Sao_Paulo",
    )
    assert "amoxicilina" in parsed.medication_name.lower()
    assert parsed.dosage and "500" in parsed.dosage
    assert parsed.frequency_every_hours == 8
    assert parsed.remind_before_minutes == 15
    assert parsed.missing_fields == []
    assert parsed.first_dose_at.isoformat().startswith("2026-07-23T14:00:00")
    plan = build_dose_plan(parsed)
    assert len(plan) > 10
    assert plan[0].remind_at < plan[0].scheduled_at


def test_asks_for_end_date():
    parsed = parse_heuristic(
        "Dipirona 500mg de 6 em 6 horas começando agora",
        now=datetime(2026, 7, 23, 10, 0, tzinfo=ZoneInfo("America/Sao_Paulo")),
        timezone="America/Sao_Paulo",
    )
    assert "endsAt" in parsed.missing_fields
    assert parsed.clarifying_question
    assert "dias" in parsed.clarifying_question.lower()
