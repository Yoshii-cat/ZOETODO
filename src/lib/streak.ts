import { addDays, isWeekend } from "./date";
import type { Completion } from "./supabase";

/** Tasks that only count on school days: weekends never break the streak. */
export const WEEKDAY_ONLY = new Set(["homework", "study"]);

/**
 * Consecutive days done, counting back from today.
 *
 * Today is treated as still in progress: if there is no row for today yet the
 * streak is measured from yesterday instead of being reset to zero. A skip or a
 * missed day on any earlier day ends the streak.
 */
export function currentStreak(
  taskId: string,
  today: string,
  byDay: Map<string, Completion>
): number {
  const weekdayOnly = WEEKDAY_ONLY.has(taskId);
  let streak = 0;
  let day = today;

  // Look back a bounded distance so a broken chain can never loop forever.
  for (let i = 0; i < 400; i++) {
    if (weekdayOnly && isWeekend(day)) {
      day = addDays(day, -1);
      continue;
    }
    const row = byDay.get(day);
    if (row?.status === "done") {
      streak++;
    } else if (!row && day === today) {
      // The day is not over yet, so nothing recorded is not a miss. An actual
      // skip today is a miss, which is why this only covers the empty case.
    } else {
      break;
    }
    day = addDays(day, -1);
  }

  return streak;
}
