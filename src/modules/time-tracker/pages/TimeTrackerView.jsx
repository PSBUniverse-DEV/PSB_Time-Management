/**
 * Client Component — TimeTrackerView.jsx
 *
 * PSB Time Tracker — Logs Page
 * Redesigned with dark teal sidebar, mint-green filter card,
 * and detailed time log table with sub-rows.
 *
 * No mocked data — pure layout shell with live clock.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Button,
  InlineEditCell,
  Input,
  Modal,
  StatusBadge,
  TableZ,
  toastError,
  toastSuccess,
  toastWarning,
} from "@/shared/components/ui";
import {
  faBolt,
  faChevronLeft,
  faChevronRight,
  faDownload,
  faGear,
  faPlus,
  faTable,
  faClock,
  faFileInvoiceDollar,
  faStamp,
} from "@fortawesome/free-solid-svg-icons";

// Module styles
import "../timeTracker.css";

// Server actions for loading logs + clock in/clock out
import {
  approveTimesheetStage,
  clockIn as clockInAction,
  clockOut as clockOutAction,
  loadApprovalQueue,
  loadSubmissionLogs,
  loadCurrentUserHoursTarget,
  loadCurrentUserPermissionsData,
  loadEditReasons,
  loadEditReasonsAdmin,
  loadEmployeeHoursTargets,
  loadTimesheetsForWeek,
  loadTimeTrackerData,
  loadWeekSubmissionStatus,
  returnTimesheetStage,
  saveEditReason,
  saveTimeLogEntry as saveTimeLogEntryAction,
  setEditReasonActive,
  setUserWeeklyHoursTarget,
  submitTimesheet as submitTimesheetAction,
} from "../data/timeTracker.actions";
import { getTimeTrackerPermissions } from "../data/timeTracker.permissions";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

function buildNavItems(permissions) {
  const items = [];
  if (permissions.canViewLogsTab)
    items.push({ key: "logs", label: "Logs", icon: faTable });
  if (permissions.canViewTimesheetsTab) {
    items.push({
      key: "timesheets",
      label: "Timesheets",
      icon: faFileInvoiceDollar,
    });
  }
  if (permissions.canViewApprovalsTab) {
    items.push({ key: "approvals", label: "Approvals", icon: faStamp });
  }
  if (permissions.canViewSetupTab) {
    items.push({ key: "setup", label: "Setup", icon: faGear });
  }
  return items;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Browser's IANA timezone (e.g. "America/Chicago"). Passed to clock in/clock out so
// timestamps are written in the user's local time rather than the server's.
const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Format a Date into a human-readable clock time (e.g. "08:59 PM").
 * Used to display the most recent clock-in time on the sidebar status card.
 */
function formatClockTime(date) {
  if (!date) return "--";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** "SEP 21, 2026" — Timesheets page date-only cells. */
function formatSheetDate(dateStr) {
  if (!dateStr) return "--";
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

/** "SEP 21, 2026 | 09:00 PM" — Timesheets page clock-in/out cells. */
function formatSheetDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return "--";
  const d = new Date(`${dateStr}T${timeStr}`);
  const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  const timePart = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${datePart} | ${timePart}`;
}

/** Weeks between today's Monday and the Monday of the week containing `dateStr`. */
function computeWeekOffsetFromToday(dateStr) {
  const picked = new Date(`${dateStr}T00:00:00`);
  const pickedMonday = new Date(picked);
  pickedMonday.setDate(picked.getDate() - ((picked.getDay() + 6) % 7));

  const now = new Date();
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const diffDays = Math.round((pickedMonday - thisMonday) / (1000 * 60 * 60 * 24));
  return diffDays / 7;
}

/**
 * Local date as YYYY-MM-DD (matches the server actions' date format).
 */
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format a "YYYY-MM-DD" date string for display (e.g. "Sep 9, 2026").
 */
function formatDateDisplay(dateStr) {
  if (!dateStr) return "--";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format an "HH:MM:SS" time string into a 12-hour display (e.g. "8:59 AM").
 */
function formatTimeDisplay(timeStr) {
  if (!timeStr) return "--";
  const [hStr, mStr] = timeStr.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Convert a "h:mm AM/PM" display string (as stored in the logs) into the
 * 24-hour "HH:MM" value expected by <input type="time">. Returns "" for
 * anything that doesn't look like a 12-hour time.
 */
function toTimeInputValue(timeStr) {
  const match = String(timeStr || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "";
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

// ═══════════════════════════════════════════════════════════════
// HOOK: useLogsPage
// ═══════════════════════════════════════════════════════════════

function useLogsPage(initialData, permissions) {
  const [weeklyHoursTarget, setWeeklyHoursTarget] = useState(
    Number(initialData?.weeklyHoursTarget) || 40,
  );
  const [hasHoursTarget, setHasHoursTarget] = useState(Boolean(initialData?.hasHoursTarget));
  const navItems = useMemo(() => buildNavItems(permissions), [permissions]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeNav, setActiveNav] = useState(navItems[0]?.key || "logs");
  const [weekOffset, setWeekOffset] = useState(0);

  // Clock session state — seeded from server data, then kept in sync after
  // each clock-in / clock-out action below.
  const [clockedIn, setClockedIn] = useState(Boolean(initialData?.clockedIn));
  const [openLogId, setOpenLogId] = useState(initialData?.openLogId ?? null);
  const [lastClockIn, setLastClockIn] = useState(
    initialData?.lastClockIn ? new Date(initialData.lastClockIn) : null,
  );
  const [toggling, setToggling] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekLogs, setWeekLogs] = useState(initialData?.logs || []);
  const [submissionStatus, setSubmissionStatus] = useState({
    hasSubmission: false,
    statusName: null,
    submittedAt: null,
    remarks: "",
  });
  const [remarks, setRemarks] = useState("");
  const [submittingTimesheet, setSubmittingTimesheet] = useState(false);

  // Live clock tick
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Keep the Summary panel's hours target in sync with Setup. Refetches
  // whenever the Logs tab becomes active (that's the only place it's
  // shown), skipping the first render since initialData is already fresh.
  const isFirstNavRender = useRef(true);
  useEffect(() => {
    if (isFirstNavRender.current) {
      isFirstNavRender.current = false;
      return;
    }
    if (activeNav !== "logs") return;

    let cancelled = false;
    loadCurrentUserHoursTarget().then((data) => {
      if (cancelled) return;
      setWeeklyHoursTarget(Number(data.weeklyHoursTarget) || 40);
      setHasHoursTarget(Boolean(data.hasHoursTarget));
    });
    return () => {
      cancelled = true;
    };
  }, [activeNav]);

  // Compute week date range for the header
  const weekRange = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (d) =>
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

    return {
      start: monday,
      end: sunday,
      label: `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      fullLabel: `Time Log for ${formatDate(monday)} - ${formatDate(sunday)}`,
    };
  }, [weekOffset]);

  // Refetch logs whenever the visible week changes. The first render is
  // skipped because that data already arrived from the server via initialData.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    let cancelled = false;
    setWeekLoading(true);
    loadTimeTrackerData(toDateStr(weekRange.start), toDateStr(weekRange.end))
      .then((data) => {
        if (!cancelled) setWeekLogs(data.logs || []);
      })
      .catch(() => {
        if (!cancelled)
          toastError("Unable to load this week's time logs.", "Time Logs");
      })
      .finally(() => {
        if (!cancelled) setWeekLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekRange]);

  // Submission status isn't part of initialData, so this fetches on every
  // render including the first, not just on subsequent week changes.
  useEffect(() => {
    let cancelled = false;
    loadWeekSubmissionStatus(toDateStr(weekRange.start))
      .then((data) => {
        if (cancelled) return;
        setSubmissionStatus(data);
        setRemarks(data.remarks || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weekRange]);

  const isSubmissionLocked = useMemo(() => {
    const name = String(submissionStatus.statusName || "").toLowerCase();
    return submissionStatus.hasSubmission && (name === "pending" || name === "approved");
  }, [submissionStatus]);

  // Map the current week's logs onto the seven day rows for the table.
  const weekRows = useMemo(() => {
    const monday = weekRange.start;
    const logsByDate = new Map(weekLogs.map((log) => [log.clock_in_date, log]));
    const today = toDateStr(new Date());
    return DAYS_OF_WEEK.map((dayName, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const rowDate = toDateStr(date);
      const log = logsByDate.get(rowDate);
      return {
        id: `day-${index}`,
        isoDate: rowDate,
        dayName,
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        shortDate: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        isToday: rowDate === today,
        clockedInDate: log ? formatDateDisplay(log.clock_in_date) : null,
        clockedInTime: log ? formatTimeDisplay(log.clock_in_time) : null,
        clockOutIsoDate: log?.clock_out_date ?? null,
        clockedOutDate: log?.clock_out_date
          ? formatDateDisplay(log.clock_out_date)
          : null,
        clockedOutTime: log?.clock_out_time
          ? formatTimeDisplay(log.clock_out_time)
          : null,
        hours: log?.total_hours ?? null,
        hasData: Boolean(log),
        logId: log?.log_id ?? null,
      };
    });
  }, [weekRange, weekLogs]);

  const totalHours = useMemo(
    () => weekRows.reduce((total, row) => total + (Number(row.hours) || 0), 0),
    [weekRows],
  );

  const regularHours = useMemo(
    () => Math.min(totalHours, weeklyHoursTarget),
    [totalHours, weeklyHoursTarget],
  );

  const overtimeHours = useMemo(
    () => Math.max(totalHours - weeklyHoursTarget, 0),
    [totalHours, weeklyHoursTarget],
  );

  const goPreviousWeek = useCallback(
    () => setWeekOffset((prev) => prev - 1),
    [],
  );
  const goNextWeek = useCallback(() => setWeekOffset((prev) => prev + 1), []);
  const goThisWeek = useCallback(() => setWeekOffset(0), []);
  const goToWeekOfDate = useCallback(
    (dateStr) => setWeekOffset(computeWeekOffsetFromToday(dateStr)),
    [],
  );

  // Clock in/clock out against the database via server actions.
  const handleClockToggle = useCallback(async () => {
    if (toggling) return;
    if (!clockedIn && !hasHoursTarget) {
      toastWarning(
        "Your weekly hours target hasn't been set up yet. Contact your admin.",
        "Clock In Unavailable",
      );
      return;
    }
    setToggling(true);
    try {
      if (!clockedIn) {
        const result = await clockInAction(LOCAL_TIMEZONE);
        if (result.success) {
          setClockedIn(true);
          setOpenLogId(result.record.log_id);
          setLastClockIn(
            new Date(
              `${result.record.clock_in_date}T${result.record.clock_in_time}`,
            ),
          );
          setWeekLogs((prev) => [
            ...prev.filter((l) => l.log_id !== result.record.log_id),
            result.record,
          ]);
        } else {
          const message = result.error || "Failed to clock in.";
          if (message.toLowerCase().includes("already")) {
            toastWarning(message, "Clock Status");
          } else {
            toastError(message, "Clock In");
          }
        }
      } else {
        const result = await clockOutAction(openLogId, LOCAL_TIMEZONE);
        if (result.success) {
          setClockedIn(false);
          setOpenLogId(null);
          setWeekLogs((prev) =>
            prev.map((l) =>
              l.log_id === result.record.log_id ? result.record : l,
            ),
          );
        } else {
          const message = result.error || "Failed to clock out.";
          if (message.toLowerCase().includes("already")) {
            toastWarning(message, "Clock Status");
          } else {
            toastError(message, "Clock Out");
          }
        }
      }
    } catch (err) {
      console.error("Clock toggle failed:", err);
      toastError("Something went wrong. Please try again.", "Time Tracker");
    } finally {
      setToggling(false);
    }
  }, [clockedIn, hasHoursTarget, openLogId, toggling]);

  // Save an edit (or a brand-new manual entry) from EditEntryModal.
  const handleSaveEdit = useCallback(async (formData) => {
    const result = await saveTimeLogEntryAction(formData);
    if (result.success) {
      setWeekLogs((prev) => {
        const exists = prev.some((l) => l.log_id === result.record.log_id);
        return exists
          ? prev.map((l) => (l.log_id === result.record.log_id ? result.record : l))
          : [...prev, result.record];
      });
      toastSuccess("Time entry saved.", "Time Tracker");
    } else {
      toastError(result.error || "Failed to save time entry.", "Time Tracker");
    }
    return result;
  }, []);

  const handleSubmitTimesheet = useCallback(async () => {
    if (submittingTimesheet || isSubmissionLocked) return;
    if (!permissions.isRequestor) {
      toastWarning(
        'You need the "Timesheet Requestor - VA" org role to submit a timesheet.',
        "Submit Timesheet",
      );
      return;
    }
    setSubmittingTimesheet(true);
    try {
      const result = await submitTimesheetAction({
        weekStartDate: toDateStr(weekRange.start),
        weekEndDate: toDateStr(weekRange.end),
        remarks,
      });
      if (result.success) {
        toastSuccess("Timesheet submitted for approval.", "Time Tracker");
        const refreshed = await loadWeekSubmissionStatus(toDateStr(weekRange.start));
        setSubmissionStatus(refreshed);
      } else {
        toastError(result.error || "Failed to submit timesheet.", "Time Tracker");
      }
    } catch (err) {
      console.error("submitTimesheet failed:", err);
      toastError("Something went wrong. Please try again.", "Time Tracker");
    } finally {
      setSubmittingTimesheet(false);
    }
  }, [submittingTimesheet, isSubmissionLocked, permissions.isRequestor, weekRange, remarks]);

  return {
    currentTime,
    activeNav,
    setActiveNav,
    navItems,
    weekRange,
    weekRows,
    goPreviousWeek,
    goNextWeek,
    goThisWeek,
    goToWeekOfDate,

    weekOffset,
    weekLoading,
    totalHours,
    regularHours,
    overtimeHours,
    weeklyHoursTarget,
    hasHoursTarget,
    clockedIn,
    lastClockIn,
    handleClockToggle,
    handleSaveEdit,
    toggling,
    submissionStatus,
    remarks,
    setRemarks,
    isSubmissionLocked,
    submittingTimesheet,
    handleSubmitTimesheet,
  };
}

/**
 * Non-blocking modal-style loading overlay shown while a clock in / clock out
 * server action is in flight. Uses `pointer-events: none` so the user can keep
 * clicking and working on the page behind the panel while it processes.
 */
function LoadingPanel({ message }) {
  return (
    <div className="tt-loading-panel" role="status" aria-live="polite">
      <div className="tt-loading-dialog">
        <span className="tt-loading-spinner" aria-hidden="true" />
        <span className="tt-loading-message">{message}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── Sidebar ──────────────────────────────────────────────────

function Sidebar({
  currentTime,
  activeNav,
  onNavChange,
  clockedIn,
  lastClockIn,
  navItems,
  onToggle,
  disabled,
  hasHoursTarget,
}) {
  const timeStr = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const dateStr = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="tt-sidebar">
      <div className="tt-module-identity">
        <span className="tt-module-mark" aria-hidden="true">
          TT
        </span>
        <div>
          <div className="tt-module-title-row">
            <div className="tt-module-title">Time Tracker</div>
          </div>
          <div className="tt-module-caption">Workday activity</div>
        </div>
      </div>

      <TimeInOutButton
        clockedIn={clockedIn}
        onToggle={onToggle}
        disabled={disabled || (!clockedIn && !hasHoursTarget)}
      />

      {/* Clock Status */}
      <div className="tt-sidebar-status-card">
        <StatusBadge
          status={clockedIn ? "active" : "inactive"}
          label={clockedIn ? "Clocked In" : "Not Clocked In"}
          className="tt-status-badge"
        />
        {!clockedIn && !hasHoursTarget && (
          <p className="tt-sidebar-warning">
            Weekly hours target not set. Contact your admin to enable Clock In.
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="tt-sidebar-nav">
        <div className="tt-sidebar-nav-label">Navigation</div>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tt-nav-item ${activeNav === item.key ? "active" : ""}`}
            onClick={() => onNavChange(item.key)}
          >
            <FontAwesomeIcon icon={item.icon} className="tt-nav-icon" />
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function TimeInOutButton({ clockedIn, onToggle, disabled }) {
  return (
    <button
      type="button"
      className={`tt-clock-btn ${clockedIn ? "clocked-in" : ""}`}
      onClick={onToggle}
      disabled={disabled}
    >
      <FontAwesomeIcon icon={faClock} className="tt-clock-btn-icon" />
      {clockedIn ? "Clock Out" : "Clock In"}
    </button>
  );
}

function LogsToolbar() {
  return (
    <div className="tt-logs-toolbar">
      <button type="button" className="tt-btn-export">
        <FontAwesomeIcon icon={faDownload} />
      </button>
    </div>
  );
}

// ─── Time Log Table ───────────────────────────────────────────

// ─── Logs Table Column Definitions (shared TableZ) ─────────────

const LOG_TABLE_COLUMNS = [
  {
    key: "dayName",
    label: "Day",
    minWidth: 150,
    render: (row) => (
      <div className={`tt-day-cell-wrap${row.isToday ? " is-today" : ""}`}>
        <div className="tt-day-cell-line">
          <span className="tt-day-marker" aria-hidden="true" />
          <span className="tt-day-cell">{row.dayName}</span>
          {row.isToday && <span className="tt-today-badge">Today</span>}
        </div>
        <span className="tt-day-date">{row.shortDate}</span>
      </div>
    ),
  },
  {
    key: "clockedIn",
    label: "Clocked In (Date & Time)",
    minWidth: 160,
    render: (row) =>
      row.hasData ? (
        <div className="tt-clock-cell">
          <span className="tt-clock-value">{row.clockedInDate}</span>
          <span className="tt-clock-value">{row.clockedInTime}</span>
        </div>
      ) : (
        <div className="tt-clock-cell">
          <span className="tt-clock-value subtle tt-placeholder">--</span>
          <span className="tt-clock-value subtle tt-placeholder">--</span>
        </div>
      ),
  },
  {
    key: "clockedOut",
    label: "Clocked Out (Date & Time)",
    minWidth: 160,
    render: (row) =>
      row.hasData ? (
        <div className="tt-clock-cell">
          <span className="tt-clock-value">{row.clockedOutDate}</span>
          <span className="tt-clock-value">{row.clockedOutTime}</span>
        </div>
      ) : (
        <div className="tt-clock-cell">
          <span className="tt-clock-value subtle tt-placeholder">--</span>
          <span className="tt-clock-value subtle tt-placeholder">--</span>
        </div>
      ),
  },
  {
    key: "hours",
    label: "Hours",
    minWidth: 100,
    align: "center",
    render: (row) =>
      row.hasData ? (
        <span className="tt-hours-cell">{Number(row.hours).toFixed(2)}</span>
      ) : (
        <span className="tt-hours-cell tt-placeholder">--</span>
      ),
  },
];

function TimeLogTable({
  weekRange,
  weekRows,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onPickWeek,
  weekOffset,
  loading,
  onEdit,
}) {
  return (
    <div className="tt-table-card">
      {/* Table Header */}
      <div className="tt-table-header">
        <div className="tt-table-header-left">
          <button
            type="button"
            className="tt-nav-arrow"
            onClick={onPrevWeek}
            aria-label="Previous week"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button
            type="button"
            className="tt-nav-arrow"
            onClick={onNextWeek}
            aria-label="Next week"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <div className="tt-week-picker">
            <h3 className="tt-table-title">
              <span>Time Log for</span>
              <strong>{weekRange.label.replace(" - ", " – ")}</strong>
            </h3>
            <input
              type="date"
              className="tt-week-picker-input"
              value={toDateStr(weekRange.start)}
              onChange={(event) => onPickWeek(event.target.value)}
              aria-label="Jump to the week containing this date"
            />
          </div>
        </div>
        <button
          type="button"
          className="tt-pill-week"
          onClick={onThisWeek}
          disabled={weekOffset === 0}
        >
          This Week
        </button>
        <LogsToolbar />
      </div>

      <TableZ
        data={weekRows}
        columns={LOG_TABLE_COLUMNS}
        rowIdKey="id"
        actions={[
          {
            key: "edit",
            label: "Edit",
            icon: "pen",
            onClick: (row) => onEdit(row),
          },
        ]}
        loading={loading}
        loadingMessage="Loading time logs..."
        emptyMessage="No time logs for this week."
        hideSearch
        hideFooter
      />
    </div>
  );
}

// ─── Timesheet Summary Panel (right column) ───────────────────

function SummaryCard({ icon, iconClass, label, sub, value, valueClass }) {
  return (
    <div className="tt-summary-card">
      <div className={`tt-summary-card-icon ${iconClass || ""}`}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <div className="tt-summary-card-text">
        <div className="tt-summary-card-label">{label}</div>
        <div className="tt-summary-card-sub">{sub}</div>
      </div>
      <span className={`tt-summary-card-value ${valueClass || ""}`}>
        {value}
      </span>
    </div>
  );
}

function TimesheetSummary({
  weekRange,
  totalHours,
  regularHours,
  overtimeHours,
  weeklyHoursTarget,
  workedDays,
  submissionStatus,
  remarks,
  onRemarksChange,
  isRequestor,
  isSubmissionLocked,
  submitting,
  onSubmit,
}) {
  const periodLabel = `${weekRange.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekRange.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const statusLower = String(submissionStatus.statusName || "").toLowerCase();
  const pillLabel = !submissionStatus.hasSubmission ? "Not Submitted" : submissionStatus.statusName || "Submitted";
  const canResubmit = submissionStatus.hasSubmission && (statusLower === "returned" || statusLower === "rejected");
  const submitDisabled = submitting || !isRequestor || isSubmissionLocked;
  const submitLabel = submitting
    ? "Submitting..."
    : canResubmit
      ? "Resubmit Timesheet for Approval"
      : "Submit Timesheet for Approval";

  return (
    <aside
      className="tt-summary-panel"
      aria-label="Timesheet summary and actions"
    >
      <div className="tt-summary-header">
        <h3 className="tt-summary-title">Timesheet Summary</h3>
        <span className="tt-summary-status-pill">
          <span className="tt-summary-status-dot" aria-hidden="true" />
          {pillLabel}
        </span>
      </div>

      <div className="tt-summary-body">
        {/* Hours Breakdown */}
        <section className="tt-summary-section">
          <h4 className="tt-summary-section-label">Hours Breakdown</h4>
          <p className="tt-summary-period">Period: {periodLabel}</p>

          <SummaryCard
            icon={faClock}
            label="Regular Hours"
            sub={`Target: ${weeklyHoursTarget.toFixed(2)} hrs`}
            value={`${regularHours.toFixed(2)} hrs`}
          />
          <SummaryCard
            icon={faBolt}
            iconClass="tt-summary-icon-overtime"
            label="Overtime"
            sub="Hours beyond weekly target"
            value={`${overtimeHours.toFixed(2)} hrs`}
            valueClass="tt-summary-value-overtime"
          />

          <div className="tt-summary-total-card">
            <div className="tt-summary-card-text">
              <div className="tt-summary-total-label">Total Logged</div>
              <div className="tt-summary-total-sub">
                {workedDays} workday{workedDays === 1 ? "" : "s"} recorded
              </div>
            </div>
            <span className="tt-summary-total-value">
              {totalHours.toFixed(2)} hrs
            </span>
          </div>
        </section>

        {/* Approval Workflow */}
        <section className="tt-summary-section">
          <h4 className="tt-summary-section-label">Approval Workflow</h4>
          <div className="tt-summary-state-card">
            <div className="tt-summary-state-row">
              <span className="tt-summary-state-label">Submission State:</span>
              <span className="tt-summary-state-pill">{pillLabel}</span>
            </div>
            <div className="tt-summary-approver">
              <span className="tt-summary-approver-avatar" aria-hidden="true">
                {submissionStatus.approverName ? submissionStatus.approverName.charAt(0).toUpperCase() : "—"}
              </span>
              <div className="tt-summary-approver-text">
                <div className="tt-summary-approver-label">
                  Assigned Approver:
                </div>
                <div className="tt-summary-approver-name">
                  {submissionStatus.approverName || "Unassigned"}
                </div>
                <div className="tt-summary-approver-role">
                  {submissionStatus.approverRoleName || "No approver assigned yet"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Remarks / Notes */}
        <section className="tt-summary-section">
          <label
            className="tt-summary-remarks-label"
            htmlFor="submission-remarks"
          >
            Remarks / Notes
          </label>
          <textarea
            id="submission-remarks"
            className="tt-summary-remarks"
            rows="3"
            placeholder="e.g., Worked on sprint onboarding and core API integration."
            value={remarks}
            onChange={(event) => onRemarksChange(event.target.value)}
            disabled={isSubmissionLocked || submitting}
          />
          <p className="tt-summary-remarks-hint">
            Optional notes for your manager before final submission.
          </p>
        </section>

        <div className="tt-summary-actions-bar">
          <button
            type="button"
            className="tt-btn-submit tt-panel-submit"
            disabled={submitDisabled}
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
          {!isRequestor && (
            <p className="tt-summary-warning">
              Requires the &quot;Timesheet Requestor - VA&quot; role to submit.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Edit Time Entry Modal ────────────────────────────────────

function EditEntryModal({ row, onClose, onSave }) {
  const [clockInDate, setClockInDate] = useState("");
  const [clockOutDate, setClockOutDate] = useState("");
  const [clockInTime, setClockInTime] = useState("");
  const [clockOutTime, setClockOutTime] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");
  const [reasons, setReasons] = useState([]);
  const [reasonsLoading, setReasonsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed the form fields whenever a new row is opened for editing.
  // Clock Out defaults to the same date as Clock In (the common case) but
  // is independently editable for night shifts that cross midnight.
  useEffect(() => {
    if (!row) return;
    setClockInDate(row.isoDate);
    setClockOutDate(row.clockOutIsoDate || row.isoDate);
    setClockInTime(toTimeInputValue(row.clockedInTime));
    setClockOutTime(toTimeInputValue(row.clockedOutTime));
    setReasonId("");
    setNotes("");
  }, [row]);

  // Load the DB-driven reason list each time the modal opens.
  useEffect(() => {
    if (!row) return;
    let cancelled = false;
    setReasonsLoading(true);
    loadEditReasons()
      .then((data) => {
        if (!cancelled) setReasons(data);
      })
      .finally(() => {
        if (!cancelled) setReasonsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row]);

  if (!row) return null;

  const canSave = Boolean(reasonId) && Boolean(clockInTime) && !saving;

  const handleSaveClick = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await onSave({
        logId: row.logId,
        clockInDate,
        clockOutDate,
        clockInTime,
        clockOutTime,
        reasonId: Number(reasonId),
        notes,
      });
      if (!result?.success) return; // keep modal open on failure so the user can retry
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tt-modal-mask" onClick={onClose} role="presentation">
      <div
        className="tt-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Edit Time Entry"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tt-modal-header">
          <div>
            <h3 className="tt-modal-title">Edit Time Entry</h3>
            <p className="tt-modal-subtitle">
              {row.dayName}, {row.shortDate}
            </p>
          </div>
          <button
            type="button"
            className="tt-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="tt-modal-body">
          <div className="tt-modal-grid">
            <label className="tt-modal-field">
              <span className="tt-modal-label">Clock In Date</span>
              <input
                type="date"
                className="tt-modal-input"
                value={clockInDate}
                onChange={(event) => setClockInDate(event.target.value)}
              />
            </label>
            <label className="tt-modal-field">
              <span className="tt-modal-label">Clock In Time</span>
              <input
                type="time"
                className="tt-modal-input"
                value={clockInTime}
                onChange={(event) => setClockInTime(event.target.value)}
              />
            </label>
            <label className="tt-modal-field">
              <span className="tt-modal-label">Clock Out Date</span>
              <input
                type="date"
                className="tt-modal-input"
                value={clockOutDate}
                onChange={(event) => setClockOutDate(event.target.value)}
              />
            </label>
            <label className="tt-modal-field">
              <span className="tt-modal-label">Clock Out Time</span>
              <input
                type="time"
                className="tt-modal-input"
                value={clockOutTime}
                onChange={(event) => setClockOutTime(event.target.value)}
              />
            </label>
          </div>

          <label className="tt-modal-field">
            <span className="tt-modal-label">Reason for Edit</span>
            <select
              className="tt-modal-select"
              value={reasonId}
              onChange={(event) => setReasonId(event.target.value)}
              disabled={reasonsLoading}
            >
              <option value="">{reasonsLoading ? "Loading..." : "Select a reason"}</option>
              {reasons.map((reason) => (
                <option key={reason.status_id} value={reason.status_id}>
                  {reason.status_name}
                </option>
              ))}
            </select>
          </label>

          <label className="tt-modal-field">
            <span className="tt-modal-label">Notes / Memo</span>
            <textarea
              className="tt-modal-textarea"
              rows="2"
              placeholder="Optional clarification..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>

        <div className="tt-modal-footer">
          <button
            type="button"
            className="tt-modal-btn-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tt-modal-btn-save"
            onClick={handleSaveClick}
            disabled={!canSave}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Setup: Employee Hours Targets ───────────────────────

function EmployeeHoursSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    loadEmployeeHoursTargets()
      .then((data) => setRows(data))
      .catch(() => toastError("Unable to load employee hours targets.", "Setup"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadEmployeeHoursTargets()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) toastError("Unable to load employee hours targets.", "Setup");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo(
    () => [
      { key: "name", label: "Employee", minWidth: 220 },
      {
        key: "weekly_hours_target",
        label: "Weekly Hours Target",
        minWidth: 200,
        render: (row) => (
          <InlineEditCell
            value={row.weekly_hours_target}
            type="number"
            onCommit={async (nextValue) => {
              const result = await setUserWeeklyHoursTarget(row.user_id, nextValue);
              if (result.success) {
                toastSuccess(`Updated ${row.name}'s weekly target.`, "Setup");
                reload();
              } else {
                toastError(result.error || "Failed to update.", "Setup");
              }
            }}
          />
        ),
      },
    ],
    [reload],
  );

  return (
    <TableZ
      data={rows}
      columns={columns}
      rowIdKey="user_id"
      showActionColumn={false}
      loading={loading}
      loadingMessage="Loading employees..."
      emptyMessage="No employees found for this module."
      hideFooter
    />
  );
}

// ─── Admin Setup: Edit Reasons ──────────────────────────────────

function EditReasonModal({ reason, onClose, onSave }) {
  const [statusCode, setStatusCode] = useState(reason?.status_code || "");
  const [statusName, setStatusName] = useState(reason?.status_name || "");
  const [displayOrder, setDisplayOrder] = useState(reason?.display_order ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        statusId: reason?.status_id || null,
        statusCode,
        statusName,
        displayOrder,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show
      onHide={onClose}
      title={reason ? "Edit Reason" : "Add Reason"}
      footer={(
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </>
      )}
    >
      <label className="tt-modal-field">
        <span className="tt-modal-label">Code</span>
        <Input
          value={statusCode}
          onChange={(event) => setStatusCode(event.target.value)}
          placeholder="e.g. FORGOT_CLOCK_OUT"
        />
      </label>
      <label className="tt-modal-field">
        <span className="tt-modal-label">Name</span>
        <Input
          value={statusName}
          onChange={(event) => setStatusName(event.target.value)}
          placeholder="e.g. Forgot to clock out"
        />
      </label>
      <label className="tt-modal-field">
        <span className="tt-modal-label">Display Order</span>
        <Input
          type="number"
          value={displayOrder}
          onChange={(event) => setDisplayOrder(event.target.value)}
        />
      </label>
    </Modal>
  );
}

function EditReasonsSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalReason, setModalReason] = useState(null); // null = closed, {} = new, row = editing

  const reload = useCallback(() => {
    setLoading(true);
    loadEditReasonsAdmin()
      .then((data) => setRows(data))
      .catch(() => toastError("Unable to load edit reasons.", "Setup"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadEditReasonsAdmin()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) toastError("Unable to load edit reasons.", "Setup");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleActive = useCallback(
    async (row, nextActive) => {
      const result = await setEditReasonActive(row.status_id, nextActive);
      if (result.success) {
        toastSuccess(nextActive ? "Reason restored." : "Reason deactivated.", "Setup");
        reload();
      } else {
        toastError(result.error || "Failed to update reason.", "Setup");
      }
    },
    [reload],
  );

  const columns = useMemo(
    () => [
      { key: "status_code", label: "Code", minWidth: 160 },
      { key: "status_name", label: "Name", minWidth: 220 },
      { key: "display_order", label: "Order", minWidth: 90, align: "center" },
      {
        key: "is_active",
        label: "Status",
        minWidth: 120,
        render: (row) => <StatusBadge status={row.is_active ? "active" : "inactive"} />,
      },
    ],
    [],
  );

  const actions = useMemo(
    () => [
      { key: "edit", label: "Edit", icon: "pen", onClick: (row) => setModalReason(row) },
      {
        key: "deactivate",
        label: "Deactivate",
        icon: "ban",
        type: "danger",
        confirm: true,
        confirmMessage: (row) => `Deactivate "${row.status_name}"?`,
        visible: (row) => row.is_active,
        onClick: (row) => handleToggleActive(row, false),
      },
      {
        key: "restore",
        label: "Restore",
        icon: "rotate-left",
        visible: (row) => !row.is_active,
        onClick: (row) => handleToggleActive(row, true),
      },
    ],
    [handleToggleActive],
  );

  return (
    <>
      <div className="tt-setup-toolbar">
        <Button type="button" variant="primary" onClick={() => setModalReason({})}>
          <FontAwesomeIcon icon={faPlus} /> Add Reason
        </Button>
      </div>

      <TableZ
        data={rows}
        columns={columns}
        rowIdKey="status_id"
        actions={actions}
        loading={loading}
        loadingMessage="Loading reasons..."
        emptyMessage="No edit reasons configured."
        hideSearch
        hideFooter
      />

      {modalReason && (
        <EditReasonModal
          reason={modalReason.status_id ? modalReason : null}
          onClose={() => setModalReason(null)}
          onSave={async (formData) => {
            const result = await saveEditReason(formData);
            if (result.success) {
              toastSuccess("Reason saved.", "Setup");
              setModalReason(null);
              reload();
            } else {
              toastError(result.error || "Failed to save reason.", "Setup");
            }
            return result;
          }}
        />
      )}
    </>
  );
}

// ─── Approvals ──────────────────────────────────────────────────

function ApprovalActionModal({ mode, row, onClose, onSubmit }) {
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const isReturn = mode === "return";
  const canSubmit = !saving && (!isReturn || comments.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSubmit(comments);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show
      onHide={onClose}
      title={isReturn ? "Return Timesheet" : "Approve Timesheet"}
      footer={(
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={isReturn ? "danger" : "primary"}
            onClick={handleSubmit}
            loading={saving}
            disabled={!canSubmit}
          >
            {isReturn ? "Return" : "Approve"}
          </Button>
        </>
      )}
    >
      <p className="mb-2">
        {row.requestor_name}&apos;s timesheet for {row.week_start_date} – {row.week_end_date}
      </p>
      <label className="tt-modal-field">
        <span className="tt-modal-label">{isReturn ? "Reason for return" : "Comment (optional)"}</span>
        <textarea
          className="tt-modal-textarea"
          rows="3"
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          placeholder={isReturn ? "Explain what needs to be corrected..." : "Optional comment..."}
        />
      </label>
    </Modal>
  );
}

const APPROVAL_STATUS_TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "returned", label: "Returned" },
  { key: "all", label: "All" },
];

function ApprovalDetailPanel({ row }) {
  const [logs, setLogs] = useState([]);
  const [weeklyHoursTarget, setWeeklyHoursTarget] = useState(40);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadSubmissionLogs(row.submission_id)
      .then((data) => {
        if (!cancelled) {
          setLogs(data.logs || []);
          setWeeklyHoursTarget(Number(data.weeklyHoursTarget) || 40);
        }
      })
      .catch(() => {
        if (!cancelled) toastError("Unable to load logs.", "Approvals");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row.submission_id]);

  const totalHoursRendered = useMemo(
    () => logs.reduce((sum, log) => sum + (Number(log.total_hours) || 0), 0),
    [logs],
  );

  if (loading) {
    return <div className="tt-approval-detail-loading">Loading logs...</div>;
  }

  return (
    <div className="tt-approval-detail">
      <table className="tt-approval-detail-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Clocked In</th>
            <th>Clocked Out</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={4} className="tt-approval-detail-empty">
                No logs recorded for this week.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.log_id}>
                <td>{log.clock_in_date}</td>
                <td>{log.clock_in_time ? `${log.clock_in_date} ${log.clock_in_time}` : "--"}</td>
                <td>{log.clock_out_time ? `${log.clock_out_date} ${log.clock_out_time}` : "--"}</td>
                <td>{log.total_hours != null ? Number(log.total_hours).toFixed(2) : "--"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="tt-approval-detail-summary">
        <span>
          <strong>Total Hours:</strong> {totalHoursRendered.toFixed(2)} hrs
        </span>
        <span>
          <strong>Target Hours:</strong> {weeklyHoursTarget.toFixed(2)} hrs
        </span>
      </div>

      <div className="tt-approval-detail-remarks">
        <span className="tt-approval-detail-remarks-label">Remarks / Notes:</span>
        <p className="tt-approval-detail-remarks-text">{row.remarks || "No remarks provided."}</p>
      </div>
    </div>
  );
}

function ApprovalsPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [statusTab, setStatusTab] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null); // null | { mode, row }
  const [expandedRowId, setExpandedRowId] = useState(null);

  const weekRange = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const formatDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return {
      start: monday,
      end: sunday,
      fullLabel: `Approvals for ${formatDate(monday)} - ${formatDate(sunday)}`,
    };
  }, [weekOffset]);

  const reload = useCallback(() => {
    setLoading(true);
    loadApprovalQueue(toDateStr(weekRange.start))
      .then((data) => setRows(data))
      .catch(() => toastError("Unable to load approvals.", "Approvals"))
      .finally(() => setLoading(false));
  }, [weekRange]);

  useEffect(() => {
    let cancelled = false;
    loadApprovalQueue(toDateStr(weekRange.start))
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) toastError("Unable to load approvals.", "Approvals");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekRange]);

  const filteredRows = useMemo(() => {
    if (statusTab === "all") return rows;
    return rows.filter((row) => String(row.workflow_status_name || "").toLowerCase() === statusTab);
  }, [rows, statusTab]);

  const columns = useMemo(
    () => [
      { key: "requestor_name", label: "Employee", minWidth: 180 },
      {
        key: "total_hours",
        label: "Hours",
        minWidth: 90,
        align: "center",
        render: (row) => Number(row.total_hours || 0).toFixed(2),
      },
      { key: "stage_name", label: "Stage", minWidth: 160 },
      {
        key: "workflow_status_name",
        label: "Status",
        minWidth: 130,
        render: (row) => (
          <StatusBadge status={String(row.workflow_status_name || "").toLowerCase()} label={row.workflow_status_name} />
        ),
      },
      {
        key: "remarks",
        label: "Remarks",
        minWidth: 200,
        render: (row) => row.remarks || "--",
      },
    ],
    [],
  );

  const handleAction = useCallback(
    async (comments) => {
      const { mode, row } = actionModal;
      const result = mode === "approve"
        ? await approveTimesheetStage(row.stageinstance_id, comments)
        : await returnTimesheetStage(row.stageinstance_id, comments);

      if (result.success) {
        toastSuccess(mode === "approve" ? "Timesheet approved." : "Timesheet returned.", "Approvals");
        setActionModal(null);
        reload();
      } else {
        toastError(result.error || "Failed to process action.", "Approvals");
      }
    },
    [actionModal, reload],
  );

  const actions = useMemo(
    () => [
      {
        key: "approve",
        label: "Approve",
        icon: "check",
        visible: (row) => row.is_actionable,
        onClick: (row) => setActionModal({ mode: "approve", row }),
      },
      {
        key: "return",
        label: "Return",
        icon: "ban",
        visible: (row) => row.is_actionable,
        onClick: (row) => setActionModal({ mode: "return", row }),
      },
    ],
    [],
  );

  const goPreviousWeek = useCallback(() => {
    setLoading(true);
    setWeekOffset((prev) => prev - 1);
  }, []);
  const goNextWeek = useCallback(() => {
    setLoading(true);
    setWeekOffset((prev) => prev + 1);
  }, []);
  const goThisWeek = useCallback(() => {
    setLoading(true);
    setWeekOffset(0);
  }, []);
  const goToWeekOfDate = useCallback((dateStr) => {
    setLoading(true);
    setWeekOffset(computeWeekOffsetFromToday(dateStr));
  }, []);

  return (
    <div className="tt-setup-page-body">
      <div className="tt-table-header">
        <div className="tt-table-header-left">
          <button type="button" onClick={goPreviousWeek} className="tt-nav-arrow" aria-label="Previous week">
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button type="button" onClick={goNextWeek} className="tt-nav-arrow" aria-label="Next week">
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <div className="tt-week-picker">
            <h3 className="tt-table-title">{weekRange.fullLabel}</h3>
            <input
              type="date"
              className="tt-week-picker-input"
              value={toDateStr(weekRange.start)}
              onChange={(event) => goToWeekOfDate(event.target.value)}
              aria-label="Jump to the week containing this date"
            />
          </div>
        </div>
        <div className="tt-table-header-right">
          <button type="button" onClick={goThisWeek} className="tt-pill-week">
            This Week
          </button>
        </div>
      </div>

      <div className="tt-setup-subtabs">
        {APPROVAL_STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tt-setup-subtab ${statusTab === tab.key ? "active" : ""}`}
            onClick={() => setStatusTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tt-setup-content-scroll">
        <TableZ
          data={filteredRows}
          columns={columns}
          rowIdKey="stageinstance_id"
          actions={actions}
          loading={loading}
          loadingMessage="Loading approvals..."
          emptyMessage={`No ${statusTab === "all" ? "" : `${statusTab} `}timesheets for this week.`}
          hideSearch
          hideFooter
          selectedRowId={expandedRowId}
          onRowClick={(row) =>
            setExpandedRowId((prev) => (prev === row.stageinstance_id ? null : row.stageinstance_id))
          }
          renderDetail={(row) => <ApprovalDetailPanel row={row} />}
        />
      </div>

      {actionModal && (
        <ApprovalActionModal
          mode={actionModal.mode}
          row={actionModal.row}
          onClose={() => setActionModal(null)}
          onSubmit={handleAction}
        />
      )}
    </div>
  );
}

function TimesheetsPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState(() => new Set());
  const [employeeDetails, setEmployeeDetails] = useState({});
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.name.toLowerCase().includes(employeeSearch.trim().toLowerCase())),
    [employees, employeeSearch],
  );

  const weekRange = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const formatDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return {
      start: monday,
      end: sunday,
      fullLabel: `Timesheets for ${formatDate(monday)} - ${formatDate(sunday)}`,
    };
  }, [weekOffset]);

  useEffect(() => {
    let cancelled = false;
    loadTimesheetsForWeek(toDateStr(weekRange.start))
      .then((data) => {
        if (!cancelled) setEmployees(data);
      })
      .catch(() => {
        if (!cancelled) toastError("Unable to load timesheets.", "Timesheets");
      })
      .finally(() => {
        if (!cancelled) setLoadingEmployees(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekRange]);

  // Fetch detail (logs + target hours) for any newly-selected employee.
  useEffect(() => {
    selectedUserIds.forEach((userId) => {
      if (employeeDetails[userId]) return;
      const employee = employees.find((e) => e.user_id === userId);
      if (!employee) return;
      loadSubmissionLogs(employee.submission_id).then((data) => {
        const logs = data.logs || [];
        const totalHoursRendered = logs.reduce((sum, log) => sum + (Number(log.total_hours) || 0), 0);
        setEmployeeDetails((prev) => ({
          ...prev,
          [userId]: { logs, weeklyHoursTarget: Number(data.weeklyHoursTarget) || 40, totalHoursRendered },
        }));
      });
    });
  }, [selectedUserIds, employees, employeeDetails]);

  const toggleEmployee = useCallback((userId) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedUserIds((prev) => {
      const allFilteredSelected =
        filteredEmployees.length > 0 && filteredEmployees.every((e) => prev.has(e.user_id));
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredEmployees.forEach((e) => next.delete(e.user_id));
        return next;
      }
      const next = new Set(prev);
      filteredEmployees.forEach((e) => next.add(e.user_id));
      return next;
    });
  }, [filteredEmployees]);

  const goPreviousWeek = useCallback(() => {
    setLoadingEmployees(true);
    setSelectedUserIds(new Set());
    setEmployeeDetails({});
    setWeekOffset((prev) => prev - 1);
  }, []);
  const goNextWeek = useCallback(() => {
    setLoadingEmployees(true);
    setSelectedUserIds(new Set());
    setEmployeeDetails({});
    setWeekOffset((prev) => prev + 1);
  }, []);
  const goThisWeek = useCallback(() => {
    setLoadingEmployees(true);
    setSelectedUserIds(new Set());
    setEmployeeDetails({});
    setWeekOffset(0);
  }, []);
  const goToWeekOfDate = useCallback((dateStr) => {
    setLoadingEmployees(true);
    setSelectedUserIds(new Set());
    setEmployeeDetails({});
    setWeekOffset(computeWeekOffsetFromToday(dateStr));
  }, []);

  const handlePrintPdf = async () => {
    if (selectedUserIds.size === 0) return;
    setGeneratingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ unit: "pt", format: "letter" });
      let cursorY = 40;
      const pageHeight = doc.internal.pageSize.getHeight();

      Array.from(selectedUserIds).forEach((userId) => {
        const detail = employeeDetails[userId];
        const employee = employees.find((e) => e.user_id === userId);
        if (!detail || !employee) return;

        if (cursorY > pageHeight - 100) {
          doc.addPage();
          cursorY = 40;
        }

        doc.setFontSize(14);
        doc.text(employee.name, 40, cursorY);
        cursorY += 18;

        doc.setFontSize(10);
        doc.text(weekRange.fullLabel, 40, cursorY);
        cursorY += 14;
        doc.text(
          `Target Hours: ${detail.weeklyHoursTarget.toFixed(2)}   Total Hours: ${detail.totalHoursRendered.toFixed(2)}`,
          40,
          cursorY,
        );
        cursorY += 10;

        autoTable(doc, {
          startY: cursorY,
          head: [["Date", "Clocked In", "Clocked Out", "Hours"]],
          body: detail.logs.map((log) => [
            formatSheetDate(log.clock_in_date),
            log.clock_in_time ? formatSheetDateTime(log.clock_in_date, log.clock_in_time) : "--",
            log.clock_out_time ? formatSheetDateTime(log.clock_out_date, log.clock_out_time) : "--",
            log.total_hours != null ? Number(log.total_hours).toFixed(2) : "--",
          ]),
          margin: { left: 40, right: 40 },
          styles: { fontSize: 9 },
        });

        cursorY = doc.lastAutoTable.finalY + 24;

        if (employee.remarks) {
          doc.setFontSize(9);
          doc.text(`Remarks: ${employee.remarks}`, 40, cursorY);
          cursorY += 20;
        }

        cursorY += 16;
      });

      doc.save(`timesheets-${toDateStr(weekRange.start)}.pdf`);
    } catch (err) {
      console.error("Timesheet PDF generation failed:", err);
      toastError("Failed to generate PDF.", "Timesheets");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="tt-setup-page-body">
      <div className="tt-table-header">
        <div className="tt-table-header-left">
          <button type="button" onClick={goPreviousWeek} className="tt-nav-arrow" aria-label="Previous week">
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button type="button" onClick={goNextWeek} className="tt-nav-arrow" aria-label="Next week">
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <div className="tt-week-picker">
            <h3 className="tt-table-title">{weekRange.fullLabel}</h3>
            <input
              type="date"
              className="tt-week-picker-input"
              value={toDateStr(weekRange.start)}
              onChange={(event) => goToWeekOfDate(event.target.value)}
              aria-label="Jump to the week containing this date"
            />
          </div>
        </div>
        <div className="tt-table-header-right">
          <Button type="button" variant="secondary" onClick={goThisWeek}>
            This Week
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handlePrintPdf}
            loading={generatingPdf}
            disabled={selectedUserIds.size === 0}
          >
            <FontAwesomeIcon icon={faDownload} /> Print PDF
          </Button>
        </div>
      </div>

      <div className="tt-timesheets-layout">
        <aside className="tt-timesheets-employee-list">
          {employees.length > 0 && (
            <div className="tt-timesheets-search-wrap">
              <Input
                type="search"
                placeholder="Search employee..."
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
              />
            </div>
          )}

          {employees.length > 0 && (
            <label className="tt-timesheets-employee-item tt-timesheets-select-all">
              <input
                type="checkbox"
                checked={filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedUserIds.has(e.user_id))}
                onChange={toggleSelectAll}
              />
              <span className="tt-timesheets-employee-name">Select All</span>
            </label>
          )}

          {loadingEmployees ? (
            <p className="tt-timesheets-empty">Loading employees...</p>
          ) : employees.length === 0 ? (
            <p className="tt-timesheets-empty">No timesheets submitted for this week.</p>
          ) : filteredEmployees.length === 0 ? (
            <p className="tt-timesheets-empty">No employees match your search.</p>
          ) : (
            filteredEmployees.map((employee) => (
              <label key={employee.user_id} className="tt-timesheets-employee-item">
                <input
                  type="checkbox"
                  checked={selectedUserIds.has(employee.user_id)}
                  onChange={() => toggleEmployee(employee.user_id)}
                />
                <span className="tt-timesheets-employee-name" title={employee.name}>
                  {employee.name}
                </span>
                <StatusBadge
                  status={String(employee.status_name || "").toLowerCase()}
                  label={employee.status_name}
                  className="tt-timesheets-employee-badge"
                />
              </label>
            ))
          )}
        </aside>

        <div className="tt-timesheets-detail-pane">
          {selectedUserIds.size === 0 ? (
            <p className="tt-timesheets-empty">Select one or more employees to view their timesheet.</p>
          ) : (
            Array.from(selectedUserIds).map((userId) => {
              const employee = employees.find((e) => e.user_id === userId);
              const detail = employeeDetails[userId];
              if (!employee) return null;

              return (
                <div key={userId} className="tt-approval-detail">
                  <h4>{employee.name}</h4>
                  {!detail ? (
                    <div className="tt-approval-detail-loading">Loading...</div>
                  ) : (
                    <>
                      <table className="tt-approval-detail-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Clocked In</th>
                            <th>Clocked Out</th>
                            <th>Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.logs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="tt-approval-detail-empty">
                                No logs recorded for this week.
                              </td>
                            </tr>
                          ) : (
                            detail.logs.map((log) => (
                              <tr key={log.log_id}>
                                <td>{formatSheetDate(log.clock_in_date)}</td>
                                <td>{log.clock_in_time ? formatSheetDateTime(log.clock_in_date, log.clock_in_time) : "--"}</td>
                                <td>{log.clock_out_time ? formatSheetDateTime(log.clock_out_date, log.clock_out_time) : "--"}</td>
                                <td>{log.total_hours != null ? Number(log.total_hours).toFixed(2) : "--"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      <div className="tt-approval-detail-summary">
                        <span>
                          <strong>Total Hours:</strong> {detail.totalHoursRendered.toFixed(2)} hrs
                        </span>
                        <span>
                          <strong>Target Hours:</strong> {detail.weeklyHoursTarget.toFixed(2)} hrs
                        </span>
                      </div>
                      <div className="tt-approval-detail-remarks">
                        <span className="tt-approval-detail-remarks-label">Remarks / Notes:</span>
                        <p className="tt-approval-detail-remarks-text">{employee.remarks || "No remarks provided."}</p>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function AdminSetupPage() {
  const [subTab, setSubTab] = useState("hours");

  return (
    <div className="tt-setup-page-body">
      <div className="tt-page-header">
        <div className="tt-page-header-text">
          <h1 className="tt-page-title">Setup</h1>
          <p className="tt-page-subtitle">Admin-only configuration for the Time Tracker module.</p>
        </div>
      </div>

      <div className="tt-setup-subtabs">
        <button
          type="button"
          className={`tt-setup-subtab ${subTab === "hours" ? "active" : ""}`}
          onClick={() => setSubTab("hours")}
        >
          Employee Hours
        </button>
        <button
          type="button"
          className={`tt-setup-subtab ${subTab === "reasons" ? "active" : ""}`}
          onClick={() => setSubTab("reasons")}
        >
          Edit Reasons
        </button>
      </div>

      <div className="tt-setup-content-scroll">
        {subTab === "hours" ? <EmployeeHoursSection /> : <EditReasonsSection />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TimeTrackerView({ initialData }) {
  const [roles, setRoles] = useState(initialData?.roles || []);
  const [orgRoles, setOrgRoles] = useState(initialData?.orgRoles || []);
  const permissions = useMemo(
    () => getTimeTrackerPermissions(roles, orgRoles),
    [roles, orgRoles],
  );
  const {
    currentTime,
    activeNav,
    setActiveNav,
    navItems,
    weekRange,
    weekRows,
    goPreviousWeek,
    goToWeekOfDate,

    goNextWeek,
    goThisWeek,
    weekOffset,
    weekLoading,
    totalHours,
    regularHours,
    overtimeHours,
    weeklyHoursTarget,
    hasHoursTarget,
    clockedIn,
    lastClockIn,
    handleClockToggle,
    handleSaveEdit,
    toggling,
    submissionStatus,
    remarks,
    setRemarks,
    isSubmissionLocked,
    submittingTimesheet,
    handleSubmitTimesheet,
  } = useLogsPage(initialData, permissions);

  // Keep sidebar tab visibility in sync with role changes made elsewhere
  // (e.g. User Master Setup). Refetches whenever the Logs tab becomes
  // active, skipping the first render since initialData is already fresh.
  const isFirstPermissionsRender = useRef(true);
  useEffect(() => {
    if (isFirstPermissionsRender.current) {
      isFirstPermissionsRender.current = false;
      return;
    }
    if (activeNav !== "logs") return;

    let cancelled = false;
    // Ignore refetch failures — keep showing the current (stale) permissions.
    loadCurrentUserPermissionsData()
      .then((data) => {
        if (cancelled) return;
        setRoles(data.roles || []);
        setOrgRoles(data.orgRoles || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeNav]);

  const [editingRow, setEditingRow] = useState(null);
  const workedDays = weekRows.filter((row) => row.hasData).length;

  return (
    <div className="tt-app-layout">
      {/* Sidebar */}
      <Sidebar
        currentTime={currentTime}
        activeNav={activeNav}
        onNavChange={setActiveNav}
        clockedIn={clockedIn}
        lastClockIn={lastClockIn}
        navItems={navItems}
        onToggle={handleClockToggle}
        disabled={toggling}
        hasHoursTarget={hasHoursTarget}
      />

      {/* Main Content */}
      <main className="tt-main">
        {activeNav === "logs" && (
          <>
            <TimeLogTable
              weekRange={weekRange}
              weekRows={weekRows}
              onPrevWeek={goPreviousWeek}
              onNextWeek={goNextWeek}
              onThisWeek={goThisWeek}
              onPickWeek={goToWeekOfDate}
              weekOffset={weekOffset}
              loading={weekLoading}
              onEdit={setEditingRow}
            />
          </>
        )}

        {activeNav === "timesheets" && <TimesheetsPage />}

        {activeNav === "approvals" && <ApprovalsPage />}

        {activeNav === "setup" && <AdminSetupPage />}
      </main>

      {activeNav === "logs" && (
        <TimesheetSummary
          weekRange={weekRange}
          totalHours={totalHours}
          regularHours={regularHours}
          overtimeHours={overtimeHours}
          weeklyHoursTarget={weeklyHoursTarget}
          workedDays={workedDays}
          submissionStatus={submissionStatus}
          remarks={remarks}
          onRemarksChange={setRemarks}
          isRequestor={permissions.isRequestor}
          isSubmissionLocked={isSubmissionLocked}
          submitting={submittingTimesheet}
          onSubmit={handleSubmitTimesheet}
        />
      )}

      <EditEntryModal
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSave={async (formData) => {
          const result = await handleSaveEdit(formData);
          if (result.success) setEditingRow(null);
          return result;
        }}
      />

      {/* Modal-style loading overlay for clock in / clock out. Non-blocking —
          users can keep clicking / working behind it while processing. */}
      {toggling && (
        <LoadingPanel
          message={clockedIn ? "Clocking out..." : "Clocking in..."}
        />
      )}
    </div>
  );
}
