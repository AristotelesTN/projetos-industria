from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ParsedTreatment(BaseModel):
    medication_name: str = Field(alias="medicationName")
    dosage: str | None = None
    frequency_every_hours: int | None = Field(default=None, alias="frequencyEveryHours")
    times_per_day: int | None = Field(default=None, alias="timesPerDay")
    anchor_times: list[str] = Field(default_factory=list, alias="anchorTimes")
    first_dose_at: datetime = Field(alias="firstDoseAt")
    ends_at: datetime = Field(alias="endsAt")
    remind_before_minutes: int = Field(default=15, alias="remindBeforeMinutes")
    notes: str | None = None
    missing_fields: list[str] = Field(default_factory=list, alias="missingFields")
    assumptions: list[str] = Field(default_factory=list)
    clarifying_question: str | None = Field(default=None, alias="clarifyingQuestion")
    confidence: float = 0.0

    model_config = {"populate_by_name": True}


class PlannedDose(BaseModel):
    scheduled_at: datetime
    remind_at: datetime


class IntakeNeedsClarification(BaseModel):
    status: Literal["needs_clarification"] = "needs_clarification"
    question: str
    partial: dict[str, Any]
    draft_id: str | None = Field(default=None, alias="draftId")

    model_config = {"populate_by_name": True}


class IntakeReady(BaseModel):
    status: Literal["ready_for_confirm"] = "ready_for_confirm"
    draft_id: str = Field(alias="draftId")
    draft: dict[str, Any]

    model_config = {"populate_by_name": True}


class TreatmentOut(BaseModel):
    id: str
    user_id: str
    medication_name: str
    dosage: str | None
    status: str
    first_dose_at: datetime
    ends_at: datetime
    remind_before_minutes: int
    source_text: str
    dose_count: int = 0
    doses: list[dict[str, Any]] = Field(default_factory=list)


class MessageOut(BaseModel):
    id: str
    phone: str
    direction: str
    body: str
    created_at: datetime
