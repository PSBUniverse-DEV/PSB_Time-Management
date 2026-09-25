/**
 * Client Helpers — timeTracker.data.js
 *
 * Constants, utility functions for the Time Tracker module.
 * Mock data has been removed — this is a layout-only shell.
 */

// ─── Corporate Deadline ──────────────────────────────────────
export const DEFAULT_LATE_DEADLINE = "08:15";
export const DEFAULT_GRACE_PERIOD = 15; // minutes

// ─── Display Helpers ─────────────────────────────────────────

/** Format minutes into "Xh Ym" or "Xh" or "Ym" */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Format decimal hours to "X.Xh" */
export function formatDecimalHours(minutes) {
  if (!minutes || minutes <= 0) return "0.0h";
  return `${(minutes / 60).toFixed(1)}h`;
}

/** Format time string "HH:mm" to "H:MMam/pm" */
export function formatTime(timeStr) {
  if (!timeStr || timeStr === "—") return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")}${ampm}`;
}

/** Format ISO date string to readable "Mon, Jul 21" */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── Batch/Form Helpers ──────────────────────────────────────

export function createEmptyAttendanceForm() {
  return {
    employeeId: "",
    date: new Date().toISOString().split("T")[0],
    timeIn: "",
    timeOut: "",
    notes: "",
  };
}

export function createAttendanceFormFromRow(row) {
  return {
    employeeId: row.employeeId || "",
    date: row.date || "",
    timeIn: row.timeIn || "",
    timeOut: row.timeOut || "",
    notes: row.notes || "",
  };
}

// ─── Schedule Models ─────────────────────────────────────────
//
// Shared by the Setup UI (live preview + validation) and the server actions
// (final validation + weekly hours), so both always agree.
//
// Business Rule:
// A model day stores times only, never dates, because the same model is
// reused every week. Times are read in order — start, break start, break end,
// end — and any time earlier than the one before it belongs to the NEXT day.
// That is how a night shift like 22:00 → 07:00 works without storing dates.

const MINUTES_PER_DAY = 24 * 60;

/** Minimum time past the scheduled clock-out before it counts as overtime. */
export const OVERTIME_MIN_MINUTES = 60;

/** ISO weekdays, matching time_s_schedulemodelday.day_of_week (1 = Monday). */
export const SCHEDULE_DAYS = [
  { dayOfWeek: 1, label: "Monday", short: "Mon" },
  { dayOfWeek: 2, label: "Tuesday", short: "Tue" },
  { dayOfWeek: 3, label: "Wednesday", short: "Wed" },
  { dayOfWeek: 4, label: "Thursday", short: "Thu" },
  { dayOfWeek: 5, label: "Friday", short: "Fri" },
  { dayOfWeek: 6, label: "Saturday", short: "Sat" },
  { dayOfWeek: 7, label: "Sunday", short: "Sun" },
];

/** "8:00", "08:00" or "08:00:00" → "08:00". Anything else → "". */
export function toHHMM(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Put a day's times on one timeline, in minutes from midnight of the
 * clock-in day. A value of 1440 or more means "the next day".
 * Missing break times come back as null.
 */
export function resolveScheduleDay({ startTime, breakStart, breakEnd, endTime }) {
  let dayOffset = 0;
  let previous = null;

  const [start, bStart, bEnd, end] = [startTime, breakStart, breakEnd, endTime].map((raw) => {
    const hhmm = toHHMM(raw);
    if (!hhmm) return null;
    let value = toMinutes(hhmm) + dayOffset;
    if (previous != null && value < previous) {
      dayOffset += MINUTES_PER_DAY;
      value += MINUTES_PER_DAY;
    }
    previous = value;
    return value;
  });

  return { start, breakStart: bStart, breakEnd: bEnd, end };
}

/** Returns a short, plain-language error for one working day, or null if it's valid. */
export function validateScheduleDay(day) {
  const startTime = toHHMM(day?.startTime);
  const endTime = toHHMM(day?.endTime);
  const breakStart = toHHMM(day?.breakStart);
  const breakEnd = toHHMM(day?.breakEnd);

  if (!startTime || !endTime) return "Enter a start and end time.";
  if (Boolean(breakStart) !== Boolean(breakEnd)) {
    return "Enter both break times, or leave both empty.";
  }

  const r = resolveScheduleDay({ startTime, breakStart, breakEnd, endTime });

  if (breakStart) {
    if (!(r.start < r.breakStart && r.breakStart < r.breakEnd && r.breakEnd < r.end)) {
      return "Times must go in order: start, break start, break end, end.";
    }
  } else if (!(r.start < r.end)) {
    return "End time must be after the start time.";
  }

  if (r.end - r.start > MINUTES_PER_DAY) {
    return "These times add up to more than 24 hours. Check that they go in order: start, break start, break end, end.";
  }
  return null;
}

/** Scheduled working hours for one day (shift minus break). 0 if the day is invalid. */
export function computeScheduledDayHours(day) {
  if (validateScheduleDay(day)) return 0;
  const r = resolveScheduleDay(day);
  const breakMinutes = r.breakStart != null ? r.breakEnd - r.breakStart : 0;
  return Math.round(((r.end - r.start - breakMinutes) / 60) * 100) / 100;
}

/** Total scheduled hours for a model's working days. */
export function computeScheduledWeeklyHours(days) {
  const total = (days || []).reduce((sum, day) => sum + computeScheduledDayHours(day), 0);
  return Math.round(total * 100) / 100;
}

/** [1,2,3,4,5,7] → "Mon–Fri, Sun" */
export function summarizeScheduleDays(dayNumbers) {
  const sorted = [...new Set(dayNumbers || [])].sort((a, b) => a - b);
  if (!sorted.length) return "No working days";

  const shortOf = (n) => SCHEDULE_DAYS[n - 1]?.short || String(n);
  const groups = [];
  let runStart = sorted[0];
  let runEnd = sorted[0];

  for (let i = 1; i <= sorted.length; i += 1) {
    const n = sorted[i];
    if (n === runEnd + 1) {
      runEnd = n;
      continue;
    }
    if (runStart === runEnd) groups.push(shortOf(runStart));
    else if (runEnd === runStart + 1) groups.push(`${shortOf(runStart)}, ${shortOf(runEnd)}`);
    else groups.push(`${shortOf(runStart)}–${shortOf(runEnd)}`);
    runStart = n;
    runEnd = n;
  }
  return groups.join(", ");
}

/**
 * Hours for one clocked-out log, using the employee's schedule model.
 *
 * Business Rule:
 * - The schedule row used is the one for the clock-in date's weekday.
 * - Only the part of the break the person was clocked in for is removed.
 * - Overtime = full hours after the scheduled clock-out, rounded down
 *   (e.g. 1h46m → 1). Leftover minutes aren't counted.
 * - Time before the scheduled clock-in is not counted; hours start at the
 *   scheduled clock-in.
 * - Rest day or unusable schedule row: everything is regular, no break.
 *
 * All math is in minutes from midnight of the clock-in date, so night
 * shifts that end the next day work the same as day shifts.
 *
 * @param {{clockInDate:string, clockInTime:string, clockOutDate:string, clockOutTime:string}} log
 *   dates "YYYY-MM-DD", times "HH:MM" or "HH:MM:SS"
 * @param {Record<number, {startTime:string, breakStart:string, breakEnd:string, endTime:string}>} rulesByDay
 *   keyed by ISO weekday (1 = Monday)
 * @returns {{grossHours:number, totalHours:number, overtimeHours:number, countedUntilTime:?string}}
 *   grossHours can be negative (clock-out before clock-in) so callers can reject it.
 *   countedUntilTime is the time counting stopped ("HH:MM") when minutes
 *   after it were dropped, otherwise null.
 */
export function computeLogHours({ clockInDate, clockInTime, clockOutDate, clockOutTime }, rulesByDay) {
  const toMin = (value) => {
    const [h = 0, m = 0, s = 0] = String(value || "").split(":").map(Number);
    return h * 60 + m + s / 60;
  };
  const daysBetween = (from, to) => {
    const [y1, m1, d1] = from.split("-").map(Number);
    const [y2, m2, d2] = to.split("-").map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  };
  const isoWeekday = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return day === 0 ? 7 : day;
  };
  const round2 = (n) => Math.round(n * 100) / 100;

  const inMin = toMin(clockInTime);
  const outMin = daysBetween(clockInDate, clockOutDate) * MINUTES_PER_DAY + toMin(clockOutTime);
  const grossMin = outMin - inMin;

  if (grossMin < 0) {
    return { grossHours: round2(grossMin / 60), totalHours: 0, overtimeHours: 0, countedUntilTime: null };
  }

  const rule = rulesByDay?.[isoWeekday(clockInDate)];
  if (!rule || validateScheduleDay(rule)) {
    return {
      grossHours: round2(grossMin / 60),
      totalHours: round2(grossMin / 60),
      overtimeHours: 0,
      countedUntilTime: null,
    };
  }

  const shift = resolveScheduleDay(rule);

  // Early clock-in isn't paid: counting starts at the scheduled clock-in.
  const countedInMin = Math.max(inMin, shift.start);

  // Overtime is counted in whole hours after the scheduled clock-out,
  // rounded down. Leftover minutes aren't counted at all, so counting stops
  // at the scheduled clock-out plus the full overtime hours.
  const overtimeStartMin = Math.max(countedInMin, shift.end);
  const rawOvertimeMin = Math.max(outMin - overtimeStartMin, 0);
  const overtimeWholeHours = Math.floor(rawOvertimeMin / OVERTIME_MIN_MINUTES);
  const countedOutMin = overtimeWholeHours > 0
    ? overtimeStartMin + overtimeWholeHours * OVERTIME_MIN_MINUTES
    : Math.min(outMin, shift.end);

  const countedMin = Math.max(countedOutMin - countedInMin, 0);
  const breakMin = shift.breakStart != null
    ? Math.max(Math.min(countedOutMin, shift.breakEnd) - Math.max(countedInMin, shift.breakStart), 0)
    : 0;
  const totalMin = Math.max(countedMin - breakMin, 0);
  const overtimeMin = overtimeWholeHours * OVERTIME_MIN_MINUTES;

  // For display: where counting stopped, when minutes past it were dropped.
  const minuteOfDay = ((Math.round(countedOutMin) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const countedUntilTime = outMin > countedOutMin && outMin > shift.end
    ? `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`
    : null;

  return {
    grossHours: round2(grossMin / 60),
    totalHours: round2(totalMin / 60),
    overtimeHours: round2(Math.min(overtimeMin, totalMin) / 60),
    countedUntilTime,
  };
}

/**
 * Group a model's days that share the same times, for display.
 * [{Mon 8-5}, {Tue 8-5}, {Sat 9-1}] → [{ dayNumbers:[1,2], ...times }, { dayNumbers:[6], ...times }]
 * Keeps the order of the first day in each group.
 */
export function groupScheduleDays(days) {
  const groups = [];
  const byKey = new Map();
  [...(days || [])]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .forEach((day) => {
      const key = [day.startTime, day.breakStart || "", day.breakEnd || "", day.endTime].join("|");
      if (!byKey.has(key)) {
        const group = {
          dayNumbers: [],
          startTime: day.startTime,
          breakStart: day.breakStart || "",
          breakEnd: day.breakEnd || "",
          endTime: day.endTime,
        };
        byKey.set(key, group);
        groups.push(group);
      }
      byKey.get(key).dayNumbers.push(day.dayOfWeek);
    });
  return groups;
}