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