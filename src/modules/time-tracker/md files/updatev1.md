
## `data/timeTracker.actions.js` (full rewrite)

```js
/**
 * Server Actions — timeTracker.actions.js
 * Server-side data loading + clock in/out for the Time Tracker module.
 */
"use server";

import { getCurrentSession } from "@/core/auth/session.service";
import { getSupabaseAdmin } from "@/core/supabase/admin";
import {
  DEFAULT_LATE_DEADLINE,
  DEFAULT_GRACE_PERIOD,
} from "./timeTracker.data";

const STATUS_CLOCKED_IN = "CLOCKED_IN";
const STATUS_CLOCKED_OUT = "CLOCKED_OUT";

// ── Helpers ──────────────────────────────────────────────────

async function getSessionUserId() {
  const session = await getCurrentSession();
  return session?.userId || null;
}

async function getStatusId(supabase, statusCode) {
  const { data, error } = await supabase
    .from("time_s_status")
    .select("status_id")
    .eq("status_code", statusCode)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Unable to resolve status_id for ${statusCode}`);
  }
  return data.status_id;
}

/** Local date as YYYY-MM-DD (avoids UTC-shift from toISOString()). */
function todayDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local time as HH:MM:SS */
function nowTimeStr(date = new Date()) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Hours between a date+time pair, rounded to 2 decimals */
function diffHours(inDateStr, inTimeStr, outDateStr, outTimeStr) {
  const start = new Date(`${inDateStr}T${inTimeStr}`);
  const end = new Date(`${outDateStr}T${outTimeStr}`);
  return Math.round(((end - start) / (1000 * 60 * 60)) * 100) / 100;
}

// ── Reads ────────────────────────────────────────────────────

/**
 * Load this week's logs + current clock status for the logged-in user.
 * @param {string} weekStartDate - "YYYY-MM-DD"
 * @param {string} weekEndDate - "YYYY-MM-DD"
 */
export async function loadTimeTrackerData(weekStartDate, weekEndDate) {
  const userId = await getSessionUserId();

  if (!userId) {
    return {
      logs: [],
      clockedIn: false,
      openLogId: null,
      lastClockIn: null,
      config: { lateDeadline: DEFAULT_LATE_DEADLINE, gracePeriod: DEFAULT_GRACE_PERIOD },
    };
  }

  const supabase = getSupabaseAdmin();

  const { data: logs, error: logsError } = await supabase
    .from("time_t_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("clock_in_date", weekStartDate)
    .lte("clock_in_date", weekEndDate)
    .order("clock_in_date", { ascending: true });

  if (logsError) console.error("loadTimeTrackerData logs error:", logsError);

  const { data: openLog, error: openLogError } = await supabase
    .from("time_t_logs")
    .select("*")
    .eq("user_id", userId)
    .is("clock_out_time", null)
    .order("clock_in_date", { ascending: false })
    .order("clock_in_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openLogError) console.error("loadTimeTrackerData openLog error:", openLogError);

  return {
    logs: logs || [],
    clockedIn: Boolean(openLog),
    openLogId: openLog?.log_id ?? null,
    lastClockIn: openLog ? `${openLog.clock_in_date}T${openLog.clock_in_time}` : null,
    config: { lateDeadline: DEFAULT_LATE_DEADLINE, gracePeriod: DEFAULT_GRACE_PERIOD },
  };
}

// ── Writes ───────────────────────────────────────────────────

/** Clock in the current user. Fails if they already have an open session. */
export async function clockIn() {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const supabase = getSupabaseAdmin();

  const { data: existingOpen } = await supabase
    .from("time_t_logs")
    .select("log_id")
    .eq("user_id", userId)
    .is("clock_out_time", null)
    .maybeSingle();

  if (existingOpen) {
    return { success: false, error: "Already clocked in." };
  }

  const statusId = await getStatusId(supabase, STATUS_CLOCKED_IN);
  const now = new Date();

  const { data, error } = await supabase
    .from("time_t_logs")
    .insert({
      user_id: userId,
      status_id: statusId,
      clock_in_date: todayDateStr(now),
      clock_in_time: nowTimeStr(now),
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("clockIn error:", error);
    return { success: false, error: "Failed to clock in." };
  }

  return { success: true, record: data };
}

/** Clock out the current user's open session. */
export async function clockOut(logId) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const supabase = getSupabaseAdmin();

  const { data: openLog, error: fetchError } = await supabase
    .from("time_t_logs")
    .select("*")
    .eq("log_id", logId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError || !openLog) {
    return { success: false, error: "Open session not found." };
  }
  if (openLog.clock_out_time) {
    return { success: false, error: "Already clocked out." };
  }

  const statusId = await getStatusId(supabase, STATUS_CLOCKED_OUT);
  const now = new Date();
  const clockOutDate = todayDateStr(now);
  const clockOutTime = nowTimeStr(now);
  const totalHours = diffHours(openLog.clock_in_date, openLog.clock_in_time, clockOutDate, clockOutTime);

  const { data, error } = await supabase
    .from("time_t_logs")
    .update({
      status_id: statusId,
      clock_out_date: clockOutDate,
      clock_out_time: clockOutTime,
      total_hours: totalHours,
      updated_at: now.toISOString(),
      updated_by: userId,
    })
    .eq("log_id", logId)
    .select("*")
    .single();

  if (error) {
    console.error("clockOut error:", error);
    return { success: false, error: "Failed to clock out." };
  }

  return { success: true, record: data };
}

// `updateAttendanceRecord`, `deleteAttendanceRecord`, `saveSchedule`,
// `updateConfig` are unrelated to clock in/out and still stubbed — not
// touched here.
export async function updateAttendanceRecord(id, data) {
  return { success: true, id, ...data };
}
export async function deleteAttendanceRecord(id) {
  return { success: true, id };
}
export async function saveSchedule(scheduleChanges) {
  return { success: true, changes: scheduleChanges.length };
}
export async function updateConfig(config) {
  return { success: true, config };
}
```

## `pages/TimeTrackerPage.js` (full rewrite)

```js
import TimeTrackerView from "./TimeTrackerView";
import { loadTimeTrackerData } from "../data/timeTracker.actions";

export const dynamic = "force-dynamic";

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

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
```

`loadTimeTrackerData` never throws (returns safe empty defaults if there's no session), so this stays try/catch-free per the file's own rule.

## `pages/TimeTrackerView.jsx` — key changes

Replace the `useLogsPage` hook and the main export with these (everything else — `Sidebar`, `FilterCard`, `LogsToolbar`, `TimeLogTable`, `TimeInOutButton` — stays as-is):

```jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// ...existing icon imports...
import "../timeTracker.css";
import {
  clockIn as clockInAction,
  clockOut as clockOutAction,
  loadTimeTrackerData,
} from "../data/timeTracker.actions";

// ...existing NAV_ITEMS, DAYS_OF_WEEK, formatClockTime...

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "--";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return "--";
  const [hStr, mStr] = timeStr.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function useLogsPage(initialData) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeNav, setActiveNav] = useState("logs");
  const [weekOffset, setWeekOffset] = useState(0);

  const [clockedIn, setClockedIn] = useState(Boolean(initialData?.clockedIn));
  const [openLogId, setOpenLogId] = useState(initialData?.openLogId ?? null);
  const [lastClockIn, setLastClockIn] = useState(
    initialData?.lastClockIn ? new Date(initialData.lastClockIn) : null
  );
  const [toggling, setToggling] = useState(false);
  const [weekLogs, setWeekLogs] = useState(initialData?.logs || []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const weekRange = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (d) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return {
      start: monday,
      end: sunday,
      label: `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      fullLabel: `Time Log for ${formatDate(monday)} - ${formatDate(sunday)}`,
    };
  }, [weekOffset]);

  // Refetch logs whenever the visible week changes (skip first render —
  // that data already came from the server via initialData).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    let cancelled = false;
    loadTimeTrackerData(toDateStr(weekRange.start), toDateStr(weekRange.end)).then((data) => {
      if (!cancelled) setWeekLogs(data.logs || []);
    });
    return () => {
      cancelled = true;
    };
  }, [weekRange]);

  const weekRows = useMemo(() => {
    const monday = weekRange.start;
    const logsByDate = new Map(weekLogs.map((log) => [log.clock_in_date, log]));
    return DAYS_OF_WEEK.map((dayName, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const log = logsByDate.get(toDateStr(date));
      return {
        id: `day-${index}`,
        dayName,
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        clockedInDate: log ? formatDateDisplay(log.clock_in_date) : null,
        clockedInTime: log ? formatTimeDisplay(log.clock_in_time) : null,
        clockedOutDate: log?.clock_out_date ? formatDateDisplay(log.clock_out_date) : null,
        clockedOutTime: log?.clock_out_time ? formatTimeDisplay(log.clock_out_time) : null,
        hours: log?.total_hours ?? null,
        hasData: Boolean(log),
        logId: log?.log_id ?? null,
      };
    });
  }, [weekRange, weekLogs]);

  const goPreviousWeek = useCallback(() => setWeekOffset((prev) => prev - 1), []);
  const goNextWeek = useCallback(() => setWeekOffset((prev) => prev + 1), []);
  const goThisWeek = useCallback(() => setWeekOffset(0), []);

  const handleClockToggle = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (!clockedIn) {
        const result = await clockInAction();
        if (result.success) {
          setClockedIn(true);
          setOpenLogId(result.record.log_id);
          setLastClockIn(new Date(`${result.record.clock_in_date}T${result.record.clock_in_time}`));
          setWeekLogs((prev) => [...prev.filter((l) => l.log_id !== result.record.log_id), result.record]);
        } else {
          alert(result.error || "Failed to clock in.");
        }
      } else {
        const result = await clockOutAction(openLogId);
        if (result.success) {
          setClockedIn(false);
          setOpenLogId(null);
          setWeekLogs((prev) => prev.map((l) => (l.log_id === result.record.log_id ? result.record : l)));
        } else {
          alert(result.error || "Failed to clock out.");
        }
      }
    } catch (err) {
      console.error("Clock toggle failed:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setToggling(false);
    }
  }, [clockedIn, openLogId, toggling]);

  return {
    currentTime,
    activeNav,
    setActiveNav,
    weekRange,
    weekRows,
    goPreviousWeek,
    goNextWeek,
    goThisWeek,
    weekOffset,
    clockedIn,
    lastClockIn,
    handleClockToggle,
    toggling,
  };
}
```

And the main export now takes `initialData`:

```jsx
export default function TimeTrackerView({ initialData }) {
  const {
    currentTime,
    activeNav,
    setActiveNav,
    weekRange,
    weekRows,
    goPreviousWeek,
    goNextWeek,
    goThisWeek,
    weekOffset,
    clockedIn,
    lastClockIn,
    handleClockToggle,
    toggling,
  } = useLogsPage(initialData);

  return (
    <div className="tt-app-layout">
      <Sidebar
        currentTime={currentTime}
        activeNav={activeNav}
        onNavChange={setActiveNav}
        clockedIn={clockedIn}
        lastClockIn={lastClockIn}
      />
      <main className="tt-main">
        <div className="tt-page-header">
          <div className="tt-page-header-text">
            <h1 className="tt-page-title">Logs</h1>
            <p className="tt-page-subtitle">Review and export your time logs.</p>
          </div>
          <TimeInOutButton clockedIn={clockedIn} onToggle={handleClockToggle} disabled={toggling} />
        </div>
        <FilterCard />
        <LogsToolbar />
        <TimeLogTable
          weekRange={weekRange}
          weekRows={weekRows}
          onPrevWeek={goPreviousWeek}
          onNextWeek={goNextWeek}
          onThisWeek={goThisWeek}
          weekOffset={weekOffset}
        />
      </main>
    </div>
  );
}
```

`TimeInOutButton` needs one line added — `disabled` prop passed through to the `<button>`.