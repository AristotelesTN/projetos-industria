import { addHours, addMinutes, isBefore, isEqual } from "date-fns";
import type { ParsedTreatment } from "@/lib/types";

export type PlannedDose = {
  scheduledAt: Date;
  remindAt: Date;
};

function parseAnchorTimes(anchorTimes: string[], firstDoseAt: Date): Date[] {
  if (anchorTimes.length === 0) return [firstDoseAt];

  const year = firstDoseAt.getFullYear();
  const month = firstDoseAt.getMonth();
  const day = firstDoseAt.getDate();

  const anchors = anchorTimes.map((hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(year, month, day, h, m, 0, 0);
  });

  anchors.sort((a, b) => a.getTime() - b.getTime());
  return anchors;
}

export function estimateDoseCount(parsed: ParsedTreatment): number {
  return buildDosePlan(parsed).length;
}

export function buildDosePlan(parsed: ParsedTreatment): PlannedDose[] {
  const firstDoseAt = new Date(parsed.firstDoseAt);
  const endsAt = new Date(parsed.endsAt);
  const remindBefore = parsed.remindBeforeMinutes ?? 15;

  if (!(endsAt > firstDoseAt)) {
    throw new Error("A data de fim precisa ser depois da primeira dose.");
  }

  const doses: PlannedDose[] = [];
  const pushDose = (scheduledAt: Date) => {
    if (scheduledAt > endsAt) return;
    if (doses.some((d) => isEqual(d.scheduledAt, scheduledAt))) return;
    doses.push({
      scheduledAt,
      remindAt: addMinutes(scheduledAt, -remindBefore),
    });
  };

  if (parsed.frequencyEveryHours) {
    let cursor = firstDoseAt;
    while (cursor <= endsAt) {
      pushDose(cursor);
      cursor = addHours(cursor, parsed.frequencyEveryHours);
      if (doses.length > 500) break;
    }
    return doses.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  const anchors = parseAnchorTimes(parsed.anchorTimes, firstDoseAt);
  const timesPerDay = parsed.timesPerDay ?? anchors.length;
  const dailyTimes = anchors.slice(0, Math.max(timesPerDay, 1));

  let dayOffset = 0;
  while (true) {
    let addedInDay = 0;
    for (const base of dailyTimes) {
      const scheduledAt = addHours(base, dayOffset * 24);
      if (isBefore(scheduledAt, firstDoseAt) && !isEqual(scheduledAt, firstDoseAt)) {
        continue;
      }
      if (scheduledAt > endsAt) {
        return doses.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
      }
      pushDose(scheduledAt);
      addedInDay += 1;
    }
    if (addedInDay === 0 && dayOffset > 0) {
      break;
    }
    dayOffset += 1;
    if (dayOffset > 366 || doses.length > 500) break;
  }

  return doses.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}
