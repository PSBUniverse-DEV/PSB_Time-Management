
## `data/timeTracker.actions.js` — updated helpers + `clockIn`/`clockOut`

Replace `todayDateStr` and `nowTimeStr` with timezone-aware versions, and thread `timezone` through both functions:

```js
// ── Helpers ──────────────────────────────────────────────────

const FALLBACK_TZ = "UTC";

function safeTimezone(timezone) {
  if (!timezone) return FALLBACK_TZ;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    console.warn(`Invalid timezone "${timezone}", falling back to ${FALLBACK_TZ}`);
    return FALLBACK_TZ;
  }
}

/** Local date as YYYY-MM-DD in the given IANA timezone. */
function dateStrInTz(date, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Local time as HH:MM:SS in the given IANA timezone. */
function timeStrInTz(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimezone(timezone),
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}:${get("second")}`;
}

function diffHours(inDateStr, inTimeStr, outDateStr, outTimeStr) {
  const start = new Date(`${inDateStr}T${inTimeStr}`);
  const end = new Date(`${outDateStr}T${outTimeStr}`);
  return Math.round(((end - start) / (1000 * 60 * 60)) * 100) / 100;
}
```

```js
/** Clock in the current user. One session per calendar day (their local day). */
export async function clockIn(timezone) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const today = dateStrInTz(now, timezone);

  const { data: existingToday } = await supabase
    .from("time_t_logs")
    .select("log_id, clock_out_time")
    .eq("user_id", userId)
    .eq("clock_in_date", today)
    .maybeSingle();

  if (existingToday) {
    return {
      success: false,
      error: existingToday.clock_out_time ? "Already logged a session today." : "Already clocked in today.",
    };
  }

  const statusId = await getStatusId(supabase, STATUS_CLOCKED_IN);

  const { data, error } = await supabase
    .from("time_t_logs")
    .insert({
      user_id: userId,
      status_id: statusId,
      clock_in_date: today,
      clock_in_time: timeStrInTz(now, timezone),
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
export async function clockOut(logId, timezone) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const supabase = getSupabaseAdmin();

  const { data: openLog, error: fetchError } = await supabase
    .from("time_t_logs")
    .select("*")
    .eq("log_id", logId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError || !openLog) return { success: false, error: "Open session not found." };
  if (openLog.clock_out_time) return { success: false, error: "Already clocked out." };

  const statusId = await getStatusId(supabase, STATUS_CLOCKED_OUT);
  const now = new Date();
  const clockOutDate = dateStrInTz(now, timezone);
  const clockOutTime = timeStrInTz(now, timezone);
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
```

## `pages/TimeTrackerView.jsx` — detect and pass timezone

In `useLogsPage`, add a timezone constant and pass it into both calls:

```jsx
const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
```

(place this near the top of the file, outside the component — it's a constant for the browser session)

```jsx
  const handleClockToggle = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (!clockedIn) {
        const result = await clockInAction(LOCAL_TIMEZONE);
        // ...unchanged...
      } else {
        const result = await clockOutAction(openLogId, LOCAL_TIMEZONE);
        // ...unchanged...
      }
    } catch (err) {
      // ...unchanged...
    } finally {
      setToggling(false);
    }
  }, [clockedIn, openLogId, toggling]);
```

Notes on what this does and doesn't solve:
- A Dallas user clocking in at 11 PM their time and a Philippines user clocking in at 11 AM their time will each get their **own** correct local date/time written — no cross-contamination from the server's clock.
- The week-range display (`weekRange` in `useLogsPage`) already uses the browser's own `Date()` object, which is inherently local to whoever's viewing — no change needed there.
- What this doesn't cover: if a user changes system timezone mid-shift (laptop travels, or manually changed), the session's date/time is whatever the browser reports at the moment of each click — not retroactively corrected. That's an acceptable edge case for now, but worth knowing about.
- `TimeTrackerPage.js` (the server component) still computes the initial week window using the server's own date. Since the client refetches on any week navigation using its own correct local range, this only matters right at first paint near a midnight boundary — a minor, self-correcting edge case, not worth solving unless it actually bites someone.