/**
 * Server Component — TimeTrackerPage.js
 *
 * Loads the current week's logs and clock status for the logged-in user,
 * then hands that data to the client-side TimeTrackerView as `initialData`.
 *
 * `loadTimeTrackerData` never throws (it returns safe empty defaults when
 * there is no session), so this stays try/catch-free.
 */
import TimeTrackerView from "./TimeTrackerView";
import { loadTimeTrackerData } from "../data/timeTracker.actions";

export const dynamic = "force-dynamic";

/** Monday of the week containing `date`, at local midnight. */
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local date as YYYY-MM-DD. */
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function TimeTrackerPage() {
  const monday = getMondayOfWeek(new Date());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const initialData = await loadTimeTrackerData(toDateStr(monday), toDateStr(sunday));

  return <TimeTrackerView initialData={initialData} />;
}
