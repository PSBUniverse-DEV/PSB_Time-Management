/**
 * Server Actions — timeTracker.actions.js
 * Server-side data loading + clock in/clock out for the Time Tracker module.
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

/**
 * Turn a Supabase error into a single readable string for the server log.
 * Postgrest errors keep their `message` on a non-enumerable property, so
 * logging the raw object often prints nothing useful (e.g. `{}`). Surfaces
 * message/code/details/hint so the real cause is visible in the terminal.
 */
function describeError(err) {
  const parts = [];
  if (err?.message) parts.push(err.message);
  if (err?.code) parts.push(`code=${err.code}`);
  if (err?.details) parts.push(`details=${err.details}`);
  if (err?.hint) parts.push(`hint=${err.hint}`);
  return parts.length ? parts.join(" | ") : JSON.stringify(err);
}

// ── Helpers ──────────────────────────────────────────────────

/** Resolve the business user id from the active SSO session. */
async function getSessionUserId() {
  const session = await getCurrentSession();
  return session?.userId || null;
}

const TIME_TRACKER_APP_ID = 10;

async function loadTimeTrackerRoles(supabase, userId) {
  const { data: accessRows, error: accessError } = await supabase
    .from("psb_m_userapproleaccess")
    .select("role_id")
    .eq("user_id", userId)
    .eq("app_id", TIME_TRACKER_APP_ID)
    .eq("is_active", true);

  const roleIds = accessError || !Array.isArray(accessRows)
    ? []
    : [...new Set(accessRows.map((row) => row.role_id).filter(Boolean))];
  const [{ data: roles }, { data: orgAccessRows }] = await Promise.all([
    roleIds.length
      ? supabase
        .from("psb_s_role")
        .select("role_id, role_name, app_id, is_active")
        .in("role_id", roleIds)
        .eq("app_id", TIME_TRACKER_APP_ID)
        .eq("is_active", true)
      : { data: [] },
    supabase
      .from("wfk_m_userorgrole")
      .select("role_id")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  const orgRoleIds = [...new Set((orgAccessRows || []).map((row) => row.role_id).filter(Boolean))];
  const { data: orgRoles } = orgRoleIds.length
    ? await supabase
      .from("wfk_s_orgrole")
      .select("orgrole_id, name, description")
      .in("orgrole_id", orgRoleIds)
      .eq("is_active", true)
    : { data: [] };

  return {
    roles: Array.isArray(roles) ? roles : [],
    orgRoles: Array.isArray(orgRoles) ? orgRoles : [],
  };
}

/** Look up the numeric id for a status code (e.g. "CLOCKED_IN"). */
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

const FALLBACK_TZ = "UTC";

/**
 * Validate a browser-reported IANA timezone, falling back to UTC if it is
 * missing or invalid so an unexpected value can't break the date formatter.
 */
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
      roles: [],
      orgRoles: [],
      clockedIn: false,
      openLogId: null,
      lastClockIn: null,
      config: { lateDeadline: DEFAULT_LATE_DEADLINE, gracePeriod: DEFAULT_GRACE_PERIOD },
    };
  }

  const supabase = getSupabaseAdmin();
  const { roles, orgRoles } = await loadTimeTrackerRoles(supabase, userId);

  const { data: logs, error: logsError } = await supabase
    .from("time_t_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("clock_in_date", weekStartDate)
    .lte("clock_in_date", weekEndDate)
    .order("clock_in_date", { ascending: true });

  if (logsError) console.error("loadTimeTrackerData logs error:", describeError(logsError));

  const { data: openLog, error: openLogError } = await supabase
    .from("time_t_logs")
    .select("*")
    .eq("user_id", userId)
    .is("clock_out_time", null)
    .order("clock_in_date", { ascending: false })
    .order("clock_in_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openLogError) console.error("loadTimeTrackerData openLog error:", describeError(openLogError));

  return {
    logs: logs || [],
    roles,
    orgRoles,
    clockedIn: Boolean(openLog),
    openLogId: openLog?.log_id ?? null,
    lastClockIn: openLog ? `${openLog.clock_in_date}T${openLog.clock_in_time}` : null,
    config: { lateDeadline: DEFAULT_LATE_DEADLINE, gracePeriod: DEFAULT_GRACE_PERIOD },
  };
}

// ── Writes ───────────────────────────────────────────────────

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
    console.error("clockIn error:", describeError(error));
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
    console.error("clockOut error:", describeError(error));
    return { success: false, error: "Failed to clock out." };
  }

  return { success: true, record: data };
}

// `updateAttendanceRecord`, `deleteAttendanceRecord`, `saveSchedule`,
// `updateConfig` are unrelated to clock in/clock out and still stubbed — not
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