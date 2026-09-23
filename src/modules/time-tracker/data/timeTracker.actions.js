/**
 * Server Actions — timeTracker.actions.js
 * Server-side data loading + clock in/clock out for the Time Tracker module.
 */
"use server";

import { getCurrentSession } from "@/core/auth/session.service";
import { getSupabaseAdmin } from "@/core/supabase/admin";
import { getTimeTrackerPermissions } from "./timeTracker.permissions";
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

const DEFAULT_WEEKLY_HOURS_TARGET = 40;

/**
 * Look up a user's weekly hours target. `hasHoursTarget` is false when no
 * active row exists — used to gate Clock In until an admin sets one up.
 */
async function loadHoursTargetInfo(supabase, userId) {
  const { data, error } = await supabase
    .from("time_m_userhourstarget")
    .select("weekly_hours_target")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return { weeklyHoursTarget: DEFAULT_WEEKLY_HOURS_TARGET, hasHoursTarget: false };
  }
  return {
    weeklyHoursTarget: Number(data.weekly_hours_target) || DEFAULT_WEEKLY_HOURS_TARGET,
    hasHoursTarget: true,
  };
}

/**
 * Refetch just the current user's Time Tracker roles/org-roles — used to
 * keep sidebar tab visibility in sync after an Admin changes role access
 * elsewhere, without re-fetching the whole week's logs.
 */
export async function loadCurrentUserPermissionsData() {
  const userId = await getSessionUserId();
  if (!userId) return { roles: [], orgRoles: [] };

  const supabase = getSupabaseAdmin();
  return loadTimeTrackerRoles(supabase, userId);
}

/** Monday of the week containing a "YYYY-MM-DD" date string. */
function getMondayOfWeekStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const LOCKED_SUBMISSION_STATUSES = new Set(["pending", "approved"]);

/**
 * Whether the week containing `clockInDate` is locked from editing — i.e.
 * it has a submitted timesheet whose workflow instance is currently
 * Pending or Approved. Reads wfk_* tables read-only; Time Tracker never
 * writes to the workflow engine's own setup or transactional tables.
 */
async function isWeekLocked(supabase, userId, clockInDate) {
  const weekStart = getMondayOfWeekStr(clockInDate);

  const { data: submission } = await supabase
    .from("time_t_timesheetsubmissions")
    .select("submission_id")
    .eq("user_id", userId)
    .eq("week_start_date", weekStart)
    .maybeSingle();

  if (!submission) return { locked: false, statusName: null };

  const { data: instance } = await supabase
    .from("wfk_t_workflowinstance")
    .select("status_id")
    .eq("app_id", TIME_TRACKER_APP_ID)
    .eq("document_id", submission.submission_id)
    .maybeSingle();

  if (!instance?.status_id) return { locked: false, statusName: null };

  const { data: status } = await supabase
    .from("wfk_s_status")
    .select("status_name")
    .eq("status_id", instance.status_id)
    .maybeSingle();

  const statusName = String(status?.status_name || "").trim();
  const locked = LOCKED_SUBMISSION_STATUSES.has(statusName.toLowerCase());
  return { locked, statusName };
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
      weeklyHoursTarget: DEFAULT_WEEKLY_HOURS_TARGET,
      hasHoursTarget: false,
      clockedIn: false,
      openLogId: null,
      lastClockIn: null,
      config: { lateDeadline: DEFAULT_LATE_DEADLINE, gracePeriod: DEFAULT_GRACE_PERIOD },
    };
  }

  const supabase = getSupabaseAdmin();
  const { roles, orgRoles } = await loadTimeTrackerRoles(supabase, userId);
  const { weeklyHoursTarget, hasHoursTarget } = await loadHoursTargetInfo(supabase, userId);

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
    weeklyHoursTarget,
    hasHoursTarget,
    clockedIn: Boolean(openLog),
    openLogId: openLog?.log_id ?? null,
    lastClockIn: openLog ? `${openLog.clock_in_date}T${openLog.clock_in_time}` : null,
    config: { lateDeadline: DEFAULT_LATE_DEADLINE, gracePeriod: DEFAULT_GRACE_PERIOD },
  };
}

/**
 * Refetch just the current user's hours-target info — used to keep the
 * Logs tab's Summary panel in sync after an Admin edits it in Setup,
 * without re-fetching the whole week's logs.
 */
export async function loadCurrentUserHoursTarget() {
  const userId = await getSessionUserId();
  if (!userId) return { weeklyHoursTarget: DEFAULT_WEEKLY_HOURS_TARGET, hasHoursTarget: false };

  const supabase = getSupabaseAdmin();
  return loadHoursTargetInfo(supabase, userId);
}

// ── Writes ───────────────────────────────────────────────────

/** Clock in the current user. One session per calendar day (their local day). */
export async function clockIn(timezone) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const supabase = getSupabaseAdmin();

  const { hasHoursTarget } = await loadHoursTargetInfo(supabase, userId);
  if (!hasHoursTarget) {
    return {
      success: false,
      error: "Your weekly hours target hasn't been set up yet. Contact your admin.",
    };
  }

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

/** Load the "Reason for Edit" dropdown options: time_s_status rows tagged 'edit_reason'. */
export async function loadEditReasons() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("time_s_status")
    .select("status_id, status_name")
    .eq("tag", "edit_reason")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("loadEditReasons error:", describeError(error));
    return [];
  }
  return data || [];
}

// ── Admin Setup: Employee Hours Targets ─────────────────────

/** List every active platform user with their weekly hours target (defaulted to 40 if unset). */
export async function loadEmployeeHoursTargets() {
  const supabase = getSupabaseAdmin();

  const [{ data: users }, { data: targets }] = await Promise.all([
    supabase
      .from("psb_s_user")
      .select("user_id, first_name, last_name, username")
      .eq("is_active", true),
    supabase
      .from("time_m_userhourstarget")
      .select("user_id, weekly_hours_target")
      .eq("is_active", true),
  ]);

  const targetByUser = new Map((targets || []).map((t) => [t.user_id, t]));

  return (users || [])
    .map((u) => {
      const target = targetByUser.get(u.user_id);
      const name = `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.username;
      return {
        user_id: u.user_id,
        name,
        weekly_hours_target: target ? Number(target.weekly_hours_target) : DEFAULT_WEEKLY_HOURS_TARGET,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Create or update a user's weekly hours target (upsert-by-check, preserving created_by on updates). */
export async function setUserWeeklyHoursTarget(targetUserId, hours) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const numericHours = Number(hours);
  if (!Number.isFinite(numericHours) || numericHours <= 0) {
    return { success: false, error: "Enter a valid weekly hours target." };
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("time_m_userhourstarget")
    .select("target_id")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("time_m_userhourstarget")
      .update({
        weekly_hours_target: numericHours,
        is_active: true,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("target_id", existing.target_id);

    if (error) {
      console.error("setUserWeeklyHoursTarget update error:", describeError(error));
      return { success: false, error: "Failed to update hours target." };
    }
    return { success: true };
  }

  const { error } = await supabase.from("time_m_userhourstarget").insert({
    user_id: targetUserId,
    weekly_hours_target: numericHours,
    created_by: userId,
  });

  if (error) {
    console.error("setUserWeeklyHoursTarget insert error:", describeError(error));
    return { success: false, error: "Failed to set hours target." };
  }
  return { success: true };
}

// ── Admin Setup: Edit Reasons ────────────────────────────────

/** All edit_reason-tagged rows (active AND inactive) for admin management. */
export async function loadEditReasonsAdmin() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("time_s_status")
    .select("status_id, status_code, status_name, display_order, is_active")
    .eq("tag", "edit_reason")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("loadEditReasonsAdmin error:", describeError(error));
    return [];
  }
  return data || [];
}

/** Create (statusId null) or update an edit_reason row. */
export async function saveEditReason({ statusId, statusCode, statusName, displayOrder }) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const code = String(statusCode || "").trim().toUpperCase().replace(/\s+/g, "_");
  const name = String(statusName || "").trim();
  const order = Number(displayOrder) || 0;

  if (!code || !name) {
    return { success: false, error: "Code and Name are required." };
  }

  const supabase = getSupabaseAdmin();

  if (statusId) {
    const { data, error } = await supabase
      .from("time_s_status")
      .update({ status_code: code, status_name: name, display_order: order })
      .eq("status_id", statusId)
      .eq("tag", "edit_reason")
      .select("*")
      .single();

    if (error) {
      console.error("saveEditReason update error:", describeError(error));
      return { success: false, error: "Failed to save reason." };
    }
    return { success: true, record: data };
  }

  const { data, error } = await supabase
    .from("time_s_status")
    .insert({ status_code: code, status_name: name, display_order: order, tag: "edit_reason" })
    .select("*")
    .single();

  if (error) {
    console.error("saveEditReason insert error:", describeError(error));
    return { success: false, error: "Failed to create reason." };
  }
  return { success: true, record: data };
}

/** Activate or deactivate an edit_reason row — never touches session_status-tagged rows. */
export async function setEditReasonActive(statusId, isActive) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("time_s_status")
    .update({ is_active: Boolean(isActive) })
    .eq("status_id", statusId)
    .eq("tag", "edit_reason")
    .select("*")
    .single();

  if (error) {
    console.error("setEditReasonActive error:", describeError(error));
    return { success: false, error: "Failed to update reason status." };
  }
  return { success: true, record: data };
}

/**
 * Create or update a time_t_logs entry from the Edit Time Entry modal.
 * Clock-in and clock-out dates are independent so night shifts that cross
 * midnight can be recorded correctly (e.g. clock in Sep 17 08:35 PM →
 * clock out Sep 18 02:19 AM).
 *
 * @param {Object} params
 * @param {number|null} params.logId - existing log to update, or null to create a new entry.
 * @param {string} params.clockInDate - "YYYY-MM-DD" the entry's clock-in belongs to.
 * @param {string} [params.clockOutDate] - "YYYY-MM-DD" of the clock-out, required when clockOutTime is set.
 * @param {string} params.clockInTime - "HH:MM" (24-hour, from <input type="time">).
 * @param {string} params.clockOutTime - "HH:MM" (24-hour) or "" if not clocked out.
 * @param {number} params.reasonId - required time_s_status.status_id tagged 'edit_reason'.
 * @param {string} [params.notes] - optional free-text note.
 */
export async function saveTimeLogEntry({ logId, clockInDate, clockOutDate, clockInTime, clockOutTime, reasonId, notes }) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };
  if (!reasonId) return { success: false, error: "A reason for edit is required." };
  if (!clockInDate) return { success: false, error: "Clock In date is required." };
  if (!clockInTime) return { success: false, error: "Clock In time is required." };

  const supabase = getSupabaseAdmin();

  const { locked, statusName } = await isWeekLocked(supabase, userId, clockInDate);
  if (locked) {
    return {
      success: false,
      error: `This week's timesheet is ${statusName} and can no longer be edited.`,
    };
  }

  // The FK on edit_reason_id can't enforce the tag split by itself (it's a
  // shared lookup table with session-status rows too), so re-validate the
  // submitted reason actually belongs to the edit_reason list server-side
  // before trusting it, rather than relying on the client having sent a
  // value that only came from the correctly-filtered dropdown.
  const { data: reasonRow, error: reasonError } = await supabase
    .from("time_s_status")
    .select("status_id")
    .eq("status_id", reasonId)
    .eq("tag", "edit_reason")
    .eq("is_active", true)
    .maybeSingle();

  if (reasonError || !reasonRow) {
    return { success: false, error: "Invalid reason for edit." };
  }

  const hasClockOut = Boolean(clockOutTime);
  if (hasClockOut && !clockOutDate) {
    return { success: false, error: "Clock Out date is required." };
  }

  // App-level guard (replaces the dropped DB constraint): block a second
  // session landing on the same clock_in_date for this user. Excludes the
  // row being edited itself, so saving an existing entry without changing
  // its date doesn't falsely collide with itself.
  let conflictQuery = supabase
    .from("time_t_logs")
    .select("log_id")
    .eq("user_id", userId)
    .eq("clock_in_date", clockInDate);

  if (logId) {
    conflictQuery = conflictQuery.neq("log_id", logId);
  }

  const { data: conflictRow } = await conflictQuery.maybeSingle();

  if (conflictRow) {
    return { success: false, error: "Another session already exists for that Clock In date." };
  }

  const statusId = await getStatusId(supabase, hasClockOut ? STATUS_CLOCKED_OUT : STATUS_CLOCKED_IN);
  const totalHours = hasClockOut
    ? diffHours(clockInDate, `${clockInTime}:00`, clockOutDate, `${clockOutTime}:00`)
    : null;

  if (hasClockOut && totalHours < 0) {
    return { success: false, error: "Clock Out must be after Clock In." };
  }

  const payload = {
    status_id: statusId,
    clock_in_date: clockInDate,
    clock_in_time: `${clockInTime}:00`,
    clock_out_date: hasClockOut ? clockOutDate : null,
    clock_out_time: hasClockOut ? `${clockOutTime}:00` : null,
    total_hours: totalHours,
    edit_reason_id: reasonId,
    notes: notes || null,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (logId) {
    const { data, error } = await supabase
      .from("time_t_logs")
      .update(payload)
      .eq("log_id", logId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      console.error("saveTimeLogEntry update error:", describeError(error));
      return { success: false, error: "Failed to save changes." };
    }
    return { success: true, record: data };
  }

  const { data, error } = await supabase
    .from("time_t_logs")
    .insert({ ...payload, user_id: userId, created_by: userId })
    .select("*")
    .single();

  if (error) {
    console.error("saveTimeLogEntry insert error:", describeError(error));
    return { success: false, error: "Failed to create entry." };
  }
  return { success: true, record: data };
}

const WORKFLOW_STATUS_PENDING = "Pending";

/** Look up a workflow status_id by name (wfk_s_status). */
async function getWorkflowStatusId(supabase, statusName) {
  const { data, error } = await supabase
    .from("wfk_s_status")
    .select("status_id")
    .eq("status_name", statusName)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Unable to resolve workflow status_id for "${statusName}"`);
  }
  return data.status_id;
}

/**
 * Read the current submission + workflow status for a given week, for
 * display (Timesheet Summary badge) — not a gate, just a read.
 */
export async function loadWeekSubmissionStatus(weekStartDate) {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      hasSubmission: false, statusName: null, submittedAt: null, remarks: "",
      approverName: null, approverRoleName: null,
    };
  }

  const supabase = getSupabaseAdmin();

  const { data: submission } = await supabase
    .from("time_t_timesheetsubmissions")
    .select("submission_id, submitted_at, remarks")
    .eq("user_id", userId)
    .eq("week_start_date", weekStartDate)
    .maybeSingle();

  if (!submission) {
    return {
      hasSubmission: false, statusName: null, submittedAt: null, remarks: "",
      approverName: null, approverRoleName: null,
    };
  }

  const { data: instance } = await supabase
    .from("wfk_t_workflowinstance")
    .select("status_id, current_wfs_id")
    .eq("app_id", TIME_TRACKER_APP_ID)
    .eq("document_id", submission.submission_id)
    .maybeSingle();

  let statusName = null;
  if (instance?.status_id) {
    const { data: status } = await supabase
      .from("wfk_s_status")
      .select("status_name")
      .eq("status_id", instance.status_id)
      .maybeSingle();
    statusName = status?.status_name || null;
  }

  let approverName = null;
  let approverRoleName = null;

  if (instance?.current_wfs_id) {
    const { data: participant } = await supabase
      .from("wfk_m_stageparticipant")
      .select("orgrole_id")
      .eq("wfs_id", instance.current_wfs_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (participant?.orgrole_id) {
      const [{ data: orgRole }, { data: userOrgRoles }] = await Promise.all([
        supabase
          .from("wfk_s_orgrole")
          .select("name")
          .eq("orgrole_id", participant.orgrole_id)
          .maybeSingle(),
        supabase
          .from("wfk_m_userorgrole")
          .select("user_id, is_primary")
          .eq("role_id", participant.orgrole_id)
          .eq("is_active", true)
          .order("is_primary", { ascending: false })
          .limit(1),
      ]);

      approverRoleName = orgRole?.name || null;
      const approverUserId = userOrgRoles?.[0]?.user_id;

      if (approverUserId) {
        const { data: approverUser } = await supabase
          .from("psb_s_user")
          .select("first_name, last_name, username")
          .eq("user_id", approverUserId)
          .maybeSingle();

        approverName = approverUser
          ? `${approverUser.first_name || ""} ${approverUser.last_name || ""}`.trim() || approverUser.username
          : null;
      }
    }
  }

  return {
    hasSubmission: true,
    statusName,
    submittedAt: submission.submitted_at,
    remarks: submission.remarks || "",
    approverName,
    approverRoleName,
  };
}

/**
 * Submit (or resubmit) a week's timesheet for approval.
 * @param {Object} params
 * @param {string} params.weekStartDate - "YYYY-MM-DD", must be a Monday.
 * @param {string} params.weekEndDate - "YYYY-MM-DD".
 * @param {string} [params.remarks] - optional note for the approver.
 */
export async function submitTimesheet({ weekStartDate, weekEndDate, remarks }) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const supabase = getSupabaseAdmin();

  const { roles, orgRoles } = await loadTimeTrackerRoles(supabase, userId);
  const { isRequestor } = getTimeTrackerPermissions(roles, orgRoles);
  if (!isRequestor) {
    return {
      success: false,
      error: 'You don\'t have the "Timesheet Requestor - VA" org role required to submit a timesheet.',
    };
  }

  const { data: existingSubmission } = await supabase
    .from("time_t_timesheetsubmissions")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start_date", weekStartDate)
    .maybeSingle();

  if (existingSubmission) {
    const { locked, statusName } = await isWeekLocked(supabase, userId, weekStartDate);
    if (locked) {
      return {
        success: false,
        error: `This week's timesheet is already ${statusName} and doesn't need to be submitted again.`,
      };
    }
  }

  const { data: logs } = await supabase
    .from("time_t_logs")
    .select("total_hours")
    .eq("user_id", userId)
    .gte("clock_in_date", weekStartDate)
    .lte("clock_in_date", weekEndDate);

  const totalHours = (logs || []).reduce((sum, l) => sum + (Number(l.total_hours) || 0), 0);
  const { weeklyHoursTarget } = await loadHoursTargetInfo(supabase, userId);
  const regularHours = Math.min(totalHours, weeklyHoursTarget);
  const overtimeHours = Math.max(totalHours - weeklyHoursTarget, 0);

  const { data: workflow, error: workflowError } = await supabase
    .from("wfk_s_workflow")
    .select("wf_id")
    .eq("app_id", TIME_TRACKER_APP_ID)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (workflowError || !workflow) {
    return { success: false, error: "No active approval workflow is configured for Time Tracker." };
  }

  const { data: firstStage, error: stageError } = await supabase
    .from("wfk_s_workflowstages")
    .select("wfs_id")
    .eq("wf_id", workflow.wf_id)
    .eq("is_active", true)
    .order("stage_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (stageError || !firstStage) {
    return { success: false, error: "The approval workflow has no stages configured." };
  }

  const pendingStatusId = await getWorkflowStatusId(supabase, WORKFLOW_STATUS_PENDING);
  const now = new Date().toISOString();

  let submission;
  if (existingSubmission) {
    const { data, error } = await supabase
      .from("time_t_timesheetsubmissions")
      .update({
        week_end_date: weekEndDate,
        total_hours: totalHours,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        remarks: remarks || null,
        submitted_at: now,
        updated_at: now,
        updated_by: userId,
      })
      .eq("submission_id", existingSubmission.submission_id)
      .select("*")
      .single();

    if (error) {
      console.error("submitTimesheet update submission error:", describeError(error));
      return { success: false, error: "Failed to resubmit timesheet." };
    }
    submission = data;
  } else {
    const { data, error } = await supabase
      .from("time_t_timesheetsubmissions")
      .insert({
        user_id: userId,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        total_hours: totalHours,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        remarks: remarks || null,
        submitted_at: now,
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) {
      console.error("submitTimesheet insert submission error:", describeError(error));
      return { success: false, error: "Failed to submit timesheet." };
    }
    submission = data;
  }

  await supabase
    .from("time_t_logs")
    .update({ submission_id: submission.submission_id })
    .eq("user_id", userId)
    .gte("clock_in_date", weekStartDate)
    .lte("clock_in_date", weekEndDate);

  const { data: existingInstance } = await supabase
    .from("wfk_t_workflowinstance")
    .select("instance_id")
    .eq("app_id", TIME_TRACKER_APP_ID)
    .eq("document_id", submission.submission_id)
    .maybeSingle();

  let instanceId;
  if (existingInstance) {
    const { error } = await supabase
      .from("wfk_t_workflowinstance")
      .update({ status_id: pendingStatusId, current_wfs_id: firstStage.wfs_id, completed_at: null })
      .eq("instance_id", existingInstance.instance_id);

    if (error) {
      console.error("submitTimesheet update instance error:", describeError(error));
      return { success: false, error: "Failed to restart the approval workflow." };
    }
    instanceId = existingInstance.instance_id;
  } else {
    const { data, error } = await supabase
      .from("wfk_t_workflowinstance")
      .insert({
        app_id: TIME_TRACKER_APP_ID,
        wf_id: workflow.wf_id,
        status_id: pendingStatusId,
        current_wfs_id: firstStage.wfs_id,
        document_id: submission.submission_id,
        started_at: now,
        created_by: userId,
      })
      .select("instance_id")
      .single();

    if (error) {
      console.error("submitTimesheet insert instance error:", describeError(error));
      return { success: false, error: "Failed to start the approval workflow." };
    }
    instanceId = data.instance_id;
  }

  const { error: stageInstanceError } = await supabase
    .from("wfk_t_stageinstance")
    .insert({ instance_id: instanceId, wfs_id: firstStage.wfs_id, status_id: pendingStatusId });

  if (stageInstanceError) {
    console.error("submitTimesheet insert stage instance error:", describeError(stageInstanceError));
    return { success: false, error: "Failed to create the first approval step." };
  }

  return { success: true, record: submission };
}

// ── Timesheets (Admin) ──────────────────────────────────────

/** List every employee who submitted a timesheet for the given week, Admin-only. */
export async function loadTimesheetsForWeek(weekStartDate) {
  const userId = await getSessionUserId();
  if (!userId) return [];

  const supabase = getSupabaseAdmin();

  const { roles } = await loadTimeTrackerRoles(supabase, userId);
  const isAdmin = roles.some(
    (r) => String(r?.role_name || "").trim().toLowerCase() === "admin" && r.is_active !== false,
  );
  if (!isAdmin) return [];

  const { data: submissions, error } = await supabase
    .from("time_t_timesheetsubmissions")
    .select("submission_id, user_id, total_hours, remarks")
    .eq("week_start_date", weekStartDate)
    .order("user_id", { ascending: true });

  if (error) {
    console.error("loadTimesheetsForWeek error:", describeError(error));
    return [];
  }
  if (!submissions?.length) return [];

  const userIds = [...new Set(submissions.map((s) => s.user_id))];
  const { data: users } = await supabase
    .from("psb_s_user")
    .select("user_id, first_name, last_name, username")
    .in("user_id", userIds);
  const userById = new Map((users || []).map((u) => [u.user_id, u]));

  const submissionIds = submissions.map((s) => s.submission_id);
  const { data: instances } = await supabase
    .from("wfk_t_workflowinstance")
    .select("document_id, status_id")
    .eq("app_id", TIME_TRACKER_APP_ID)
    .in("document_id", submissionIds);
  const statusIdByDoc = new Map((instances || []).map((i) => [i.document_id, i.status_id]));
  const statusIds = [...new Set((instances || []).map((i) => i.status_id).filter(Boolean))];
  const { data: statuses } = statusIds.length
    ? await supabase.from("wfk_s_status").select("status_id, status_name").in("status_id", statusIds)
    : { data: [] };
  const statusNameById = new Map((statuses || []).map((s) => [s.status_id, s.status_name]));

  return submissions.map((s) => {
    const user = userById.get(s.user_id);
    const name = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username : "Unknown";
    const statusId = statusIdByDoc.get(s.submission_id);
    return {
      submission_id: s.submission_id,
      user_id: s.user_id,
      name,
      total_hours: s.total_hours,
      remarks: s.remarks,
      status_name: statusNameById.get(statusId) || "--",
    };
  });
}

// ── Approvals ────────────────────────────────────────────────

/**
 * Read-only daily logs for a submitted timesheet, for the Approvals detail
 * row. Authorized only for the submission's own owner, an approver on any
 * stage of its workflow, or an Admin — not just anyone who guesses an id.
 */
/**
 * The wfk_* authorization chain — read-only, unchanged logic, just extracted
 * for reuse/parallelizing.
 */
async function checkIsAuthorizedApprover(supabase, userId, submissionId) {
  const { data: instance } = await supabase
    .from("wfk_t_workflowinstance")
    .select("instance_id")
    .eq("app_id", TIME_TRACKER_APP_ID)
    .eq("document_id", submissionId)
    .maybeSingle();
  if (!instance) return false;

  const { data: stageInstances } = await supabase
    .from("wfk_t_stageinstance")
    .select("wfs_id")
    .eq("instance_id", instance.instance_id);
  const wfsIds = [...new Set((stageInstances || []).map((si) => si.wfs_id).filter(Boolean))];
  if (!wfsIds.length) return false;

  const { data: participants } = await supabase
    .from("wfk_m_stageparticipant")
    .select("orgrole_id")
    .in("wfs_id", wfsIds)
    .eq("is_active", true);
  const orgRoleIds = [...new Set((participants || []).map((p) => p.orgrole_id).filter(Boolean))];
  if (!orgRoleIds.length) return false;

  const { data: userOrgRole } = await supabase
    .from("wfk_m_userorgrole")
    .select("user_orgrole_id")
    .eq("user_id", userId)
    .in("role_id", orgRoleIds)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return Boolean(userOrgRole);
}

/** Lean Admin check — only fetches app-role data, unlike loadTimeTrackerRoles which also fetches unused org roles. */
async function checkIsTimeTrackerAdmin(supabase, userId) {
  const { data: accessRows } = await supabase
    .from("psb_m_userapproleaccess")
    .select("role_id")
    .eq("user_id", userId)
    .eq("app_id", TIME_TRACKER_APP_ID)
    .eq("is_active", true);
  const roleIds = [...new Set((accessRows || []).map((r) => r.role_id).filter(Boolean))];
  if (!roleIds.length) return false;

  const { data: roles } = await supabase
    .from("psb_s_role")
    .select("role_name")
    .in("role_id", roleIds)
    .eq("app_id", TIME_TRACKER_APP_ID)
    .eq("is_active", true);
  return (roles || []).some((r) => String(r.role_name || "").trim().toLowerCase() === "admin");
}

export async function loadSubmissionLogs(submissionId) {
  const userId = await getSessionUserId();
  if (!userId) return { logs: [], weeklyHoursTarget: DEFAULT_WEEKLY_HOURS_TARGET };

  const supabase = getSupabaseAdmin();

  const { data: submission } = await supabase
    .from("time_t_timesheetsubmissions")
    .select("user_id")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (!submission) return { logs: [], weeklyHoursTarget: DEFAULT_WEEKLY_HOURS_TARGET };

  const isOwner = submission.user_id === userId;

  if (!isOwner) {
    const [isAuthorizedApprover, isAdmin] = await Promise.all([
      checkIsAuthorizedApprover(supabase, userId, submissionId),
      checkIsTimeTrackerAdmin(supabase, userId),
    ]);

    if (!isAuthorizedApprover && !isAdmin) {
      return { logs: [], weeklyHoursTarget: DEFAULT_WEEKLY_HOURS_TARGET };
    }
  }

  const [logsResult, hoursTargetResult] = await Promise.all([
    supabase
      .from("time_t_logs")
      .select("*")
      .eq("submission_id", submissionId)
      .order("clock_in_date", { ascending: true }),
    loadHoursTargetInfo(supabase, submission.user_id),
  ]);

  if (logsResult.error) {
    console.error("loadSubmissionLogs error:", describeError(logsResult.error));
    return { logs: [], weeklyHoursTarget: hoursTargetResult.weeklyHoursTarget };
  }

  return { logs: logsResult.data || [], weeklyHoursTarget: hoursTargetResult.weeklyHoursTarget };
}

/**
 * Load this user's approval queue: pending items awaiting their action at
 * whichever stage their org role(s) participate in, plus history of items
 * they've personally acted on before (approved or returned).
 */
export async function loadApprovalQueue(weekStartDate) {
  const userId = await getSessionUserId();
  if (!userId) return [];

  const supabase = getSupabaseAdmin();

  const { data: userOrgRoleRows } = await supabase
    .from("wfk_m_userorgrole")
    .select("role_id")
    .eq("user_id", userId)
    .eq("is_active", true);
  const orgRoleIds = [...new Set((userOrgRoleRows || []).map((r) => r.role_id).filter(Boolean))];

  const { data: participantRows } = orgRoleIds.length
    ? await supabase
      .from("wfk_m_stageparticipant")
      .select("wfs_id")
      .in("orgrole_id", orgRoleIds)
      .eq("is_active", true)
    : { data: [] };
  const participantWfsIds = [...new Set((participantRows || []).map((r) => r.wfs_id).filter(Boolean))];

  const orFilterParts = [`acted_by.eq.${userId}`];
  if (participantWfsIds.length) {
    orFilterParts.push(`and(wfs_id.in.(${participantWfsIds.join(",")}),acted_by.is.null)`);
  }

  const { data: stageInstances, error: siError } = await supabase
    .from("wfk_t_stageinstance")
    .select("*")
    .or(orFilterParts.join(","))
    .order("created_at", { ascending: false });

  if (siError || !stageInstances?.length) return [];

  const instanceIds = [...new Set(stageInstances.map((si) => si.instance_id).filter(Boolean))];
  const wfsIds = [...new Set(stageInstances.map((si) => si.wfs_id).filter(Boolean))];

  const [{ data: workflowInstances }, { data: stages }] = await Promise.all([
    instanceIds.length
      ? supabase.from("wfk_t_workflowinstance").select("*").in("instance_id", instanceIds).eq("app_id", TIME_TRACKER_APP_ID)
      : { data: [] },
    wfsIds.length
      ? supabase.from("wfk_s_workflowstages").select("wfs_id, stage_name").in("wfs_id", wfsIds)
      : { data: [] },
  ]);

  const instanceById = new Map((workflowInstances || []).map((wi) => [wi.instance_id, wi]));
  const stageById = new Map((stages || []).map((s) => [s.wfs_id, s]));

  const relevant = stageInstances.filter((si) => instanceById.has(si.instance_id));
  if (!relevant.length) return [];

  const documentIds = [...new Set(relevant.map((si) => instanceById.get(si.instance_id).document_id).filter(Boolean))];

  const { data: submissions } = documentIds.length
    ? await supabase.from("time_t_timesheetsubmissions").select("*").in("submission_id", documentIds)
    : { data: [] };
  const submissionById = new Map((submissions || []).map((s) => [s.submission_id, s]));

  const requestorUserIds = [...new Set((submissions || []).map((s) => s.user_id).filter(Boolean))];
  const { data: requestors } = requestorUserIds.length
    ? await supabase.from("psb_s_user").select("user_id, first_name, last_name, username").in("user_id", requestorUserIds)
    : { data: [] };
  const requestorById = new Map(
    (requestors || []).map((u) => [u.user_id, `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.username]),
  );

  const workflowStatusIds = [...new Set((workflowInstances || []).map((wi) => wi.status_id).filter(Boolean))];
  const { data: workflowStatuses } = workflowStatusIds.length
    ? await supabase.from("wfk_s_status").select("status_id, status_name").in("status_id", workflowStatusIds)
    : { data: [] };
  const workflowStatusById = new Map((workflowStatuses || []).map((s) => [s.status_id, s.status_name]));

  return relevant
    .map((si) => {
      const instance = instanceById.get(si.instance_id);
      const submission = submissionById.get(instance?.document_id);
      if (!submission) return null;
      if (weekStartDate && submission.week_start_date !== weekStartDate) return null;

      return {
        stageinstance_id: si.stageinstance_id,
        instance_id: si.instance_id,
        submission_id: submission.submission_id,
        requestor_name: requestorById.get(submission.user_id) || "Unknown",
        week_start_date: submission.week_start_date,
        week_end_date: submission.week_end_date,
        total_hours: submission.total_hours,
        remarks: submission.remarks,
        stage_name: stageById.get(si.wfs_id)?.stage_name || "--",
        workflow_status_name: workflowStatusById.get(instance?.status_id) || "--",
        is_actionable: si.acted_by === null,
        acted_at: si.acted_at,
        comments: si.comments,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.is_actionable === b.is_actionable ? 0 : a.is_actionable ? -1 : 1));
}

/** Approve the given stage instance, advancing to the next stage or completing the request. */
export async function approveTimesheetStage(stageinstanceId, comments) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const supabase = getSupabaseAdmin();

  const { data: stageInstance, error: siError } = await supabase
    .from("wfk_t_stageinstance")
    .select("*")
    .eq("stageinstance_id", stageinstanceId)
    .maybeSingle();

  if (siError || !stageInstance) return { success: false, error: "Approval step not found." };
  if (stageInstance.acted_by) return { success: false, error: "This step has already been acted on." };

  const { data: stageDef } = await supabase
    .from("wfk_s_workflowstages")
    .select("wfs_id, wf_id, stage_order")
    .eq("wfs_id", stageInstance.wfs_id)
    .maybeSingle();
  if (!stageDef) return { success: false, error: "Workflow stage not found." };

  const { data: participant } = await supabase
    .from("wfk_m_stageparticipant")
    .select("orgrole_id")
    .eq("wfs_id", stageDef.wfs_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!participant) return { success: false, error: "No approver is configured for this stage." };

  const { data: userOrgRole } = await supabase
    .from("wfk_m_userorgrole")
    .select("user_orgrole_id")
    .eq("user_id", userId)
    .eq("role_id", participant.orgrole_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!userOrgRole) return { success: false, error: "You are not authorized to approve this stage." };

  const approvedStatusId = await getWorkflowStatusId(supabase, "Approved");
  const pendingStatusId = await getWorkflowStatusId(supabase, WORKFLOW_STATUS_PENDING);
  const now = new Date().toISOString();

  const { error: updateSiError } = await supabase
    .from("wfk_t_stageinstance")
    .update({ status_id: approvedStatusId, acted_at: now, acted_by: userId, comments: comments || null })
    .eq("stageinstance_id", stageinstanceId);
  if (updateSiError) {
    console.error("approveTimesheetStage update stage instance error:", describeError(updateSiError));
    return { success: false, error: "Failed to record approval." };
  }

  const { data: nextStage } = await supabase
    .from("wfk_s_workflowstages")
    .select("wfs_id")
    .eq("wf_id", stageDef.wf_id)
    .eq("is_active", true)
    .gt("stage_order", stageDef.stage_order)
    .order("stage_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextStage) {
    await supabase
      .from("wfk_t_workflowinstance")
      .update({ current_wfs_id: nextStage.wfs_id })
      .eq("instance_id", stageInstance.instance_id);

    const { error: insertNextError } = await supabase
      .from("wfk_t_stageinstance")
      .insert({ instance_id: stageInstance.instance_id, wfs_id: nextStage.wfs_id, status_id: pendingStatusId });
    if (insertNextError) {
      console.error("approveTimesheetStage insert next stage error:", describeError(insertNextError));
      return { success: false, error: "Approved this step, but failed to advance to the next one." };
    }
  } else {
    const { error: completeError } = await supabase
      .from("wfk_t_workflowinstance")
      .update({ status_id: approvedStatusId, completed_at: now })
      .eq("instance_id", stageInstance.instance_id);
    if (completeError) {
      console.error("approveTimesheetStage complete instance error:", describeError(completeError));
      return { success: false, error: "Approved this step, but failed to finalize the request." };
    }
  }

  return { success: true };
}

/** Return the given stage instance to the requestor. Requires a comment. */
export async function returnTimesheetStage(stageinstanceId, comments) {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, error: "Not authenticated." };

  const trimmedComments = String(comments || "").trim();
  if (!trimmedComments) return { success: false, error: "A comment is required when returning a timesheet." };

  const supabase = getSupabaseAdmin();

  const { data: stageInstance, error: siError } = await supabase
    .from("wfk_t_stageinstance")
    .select("*")
    .eq("stageinstance_id", stageinstanceId)
    .maybeSingle();
  if (siError || !stageInstance) return { success: false, error: "Approval step not found." };
  if (stageInstance.acted_by) return { success: false, error: "This step has already been acted on." };

  const { data: participant } = await supabase
    .from("wfk_m_stageparticipant")
    .select("orgrole_id")
    .eq("wfs_id", stageInstance.wfs_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!participant) return { success: false, error: "No approver is configured for this stage." };

  const { data: userOrgRole } = await supabase
    .from("wfk_m_userorgrole")
    .select("user_orgrole_id")
    .eq("user_id", userId)
    .eq("role_id", participant.orgrole_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!userOrgRole) return { success: false, error: "You are not authorized to act on this stage." };

  const returnedStatusId = await getWorkflowStatusId(supabase, "Returned");
  const now = new Date().toISOString();

  const { error: updateSiError } = await supabase
    .from("wfk_t_stageinstance")
    .update({ status_id: returnedStatusId, acted_at: now, acted_by: userId, comments: trimmedComments })
    .eq("stageinstance_id", stageinstanceId);
  if (updateSiError) {
    console.error("returnTimesheetStage update stage instance error:", describeError(updateSiError));
    return { success: false, error: "Failed to record the return." };
  }

  const { error: updateInstanceError } = await supabase
    .from("wfk_t_workflowinstance")
    .update({ status_id: returnedStatusId })
    .eq("instance_id", stageInstance.instance_id);
  if (updateInstanceError) {
    console.error("returnTimesheetStage update instance error:", describeError(updateInstanceError));
    return { success: false, error: "Recorded the return, but failed to update the overall request status." };
  }

  return { success: true };
}

// `deleteAttendanceRecord`, `saveSchedule`, `updateConfig` are unrelated to
// clock in/clock out or time-entry editing and still stubbed — not touched here.
export async function deleteAttendanceRecord(id) {
  return { success: true, id };
}
export async function saveSchedule(scheduleChanges) {
  return { success: true, changes: scheduleChanges.length };
}
export async function updateConfig(config) {
  return { success: true, config };
}