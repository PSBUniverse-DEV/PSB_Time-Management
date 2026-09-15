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
import { StatusBadge, toastError, toastWarning } from "@/shared/components/ui";
import {
  faChevronLeft,
  faChevronRight,
  faDownload,
  faPen,
  faTable,
  faClock,
  faFileInvoiceDollar,
  faStamp,
} from "@fortawesome/free-solid-svg-icons";

// Module styles
import "../timeTracker.css";

// Server actions for loading logs + clock in/clock out
import {
  clockIn as clockInAction,
  clockOut as clockOutAction,
  loadTimeTrackerData,
} from "../data/timeTracker.actions";
import { getTimeTrackerPermissions } from "../data/timeTracker.permissions";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

function buildNavItems(permissions) {
  const items = [];
  if (permissions.canViewLogsTab) items.push({ key: "logs", label: "Logs", icon: faTable });
  if (permissions.canViewTimesheetsTab) {
    items.push({ key: "timesheets", label: "Timesheets", icon: faFileInvoiceDollar });
  }
  if (permissions.canViewApprovalsTab) {
    items.push({ key: "approvals", label: "Approvals", icon: faStamp });
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

// ═══════════════════════════════════════════════════════════════
// HOOK: useLogsPage
// ═══════════════════════════════════════════════════════════════

function useLogsPage(initialData, permissions) {
  const navItems = useMemo(() => buildNavItems(permissions), [permissions]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeNav, setActiveNav] = useState(navItems[0]?.key || "logs");
  const [weekOffset, setWeekOffset] = useState(0);

  // Clock session state — seeded from server data, then kept in sync after
  // each clock-in / clock-out action below.
  const [clockedIn, setClockedIn] = useState(Boolean(initialData?.clockedIn));
  const [openLogId, setOpenLogId] = useState(initialData?.openLogId ?? null);
  const [lastClockIn, setLastClockIn] = useState(
    initialData?.lastClockIn ? new Date(initialData.lastClockIn) : null
  );
  const [toggling, setToggling] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekLogs, setWeekLogs] = useState(initialData?.logs || []);

  // Live clock tick
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute week date range for the header
  const weekRange = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
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
        if (!cancelled) toastError("Unable to load this week's time logs.", "Time Logs");
      })
      .finally(() => {
        if (!cancelled) setWeekLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekRange]);

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
        dayName,
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        shortDate: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        isToday: rowDate === today,
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

  const totalHours = useMemo(
    () => weekRows.reduce((total, row) => total + (Number(row.hours) || 0), 0),
    [weekRows],
  );

  const goPreviousWeek = useCallback(() => setWeekOffset((prev) => prev - 1), []);
  const goNextWeek = useCallback(() => setWeekOffset((prev) => prev + 1), []);
  const goThisWeek = useCallback(() => setWeekOffset(0), []);

  // Clock in/clock out against the database via server actions.
  const handleClockToggle = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (!clockedIn) {
        const result = await clockInAction(LOCAL_TIMEZONE);
        if (result.success) {
          setClockedIn(true);
          setOpenLogId(result.record.log_id);
          setLastClockIn(new Date(`${result.record.clock_in_date}T${result.record.clock_in_time}`));
          setWeekLogs((prev) => [...prev.filter((l) => l.log_id !== result.record.log_id), result.record]);
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
          setWeekLogs((prev) => prev.map((l) => (l.log_id === result.record.log_id ? result.record : l)));
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
  }, [clockedIn, openLogId, toggling]);

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
    weekOffset,
    weekLoading,
    totalHours,
    clockedIn,
    lastClockIn,
    handleClockToggle,
    toggling,
  };
}

function LoadingPanel({ message }) {
  return (
    <div className="tt-loading-panel" role="status" aria-live="polite">
      <span className="tt-loading-spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── Sidebar ──────────────────────────────────────────────────

function Sidebar({ currentTime, activeNav, onNavChange, clockedIn, lastClockIn, navItems, onToggle, disabled }) {
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
          <div className="tt-module-title">Time Tracker</div>
          <div className="tt-module-caption">Workday activity</div>
        </div>
      </div>

      {/* Digital Clock */}
      <div className="tt-sidebar-clock-card">
        <div className="tt-sidebar-clock-time">{timeStr}</div>
        <div className="tt-sidebar-clock-date">{dateStr}</div>
      </div>
      
      <TimeInOutButton clockedIn={clockedIn} onToggle={onToggle} disabled={disabled} />

      {/* Navigation */}
      <nav className="tt-sidebar-nav">
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

      {/* Clock Status */}
      <div className="tt-sidebar-status-card">
        <StatusBadge
          status={clockedIn ? "active" : "inactive"}
          label={clockedIn ? "Clocked In" : "Not Clocked In"}
          className="tt-status-badge"
        />
        <div className="tt-sidebar-status-meta">
          {lastClockIn ? `Last clock in: ${formatClockTime(lastClockIn)}` : "Not clocked in yet"}
        </div>
      </div>

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
        Export All Logs
      </button>
    </div>
  );
}


// ─── Time Log Table ───────────────────────────────────────────

function TimeLogTable({ weekRange, weekRows, onPrevWeek, onNextWeek, onThisWeek, weekOffset, loading, totalHours }) {
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
          <h3 className="tt-table-title">
            <span>Time Log for</span>
            <strong>{weekRange.label.replace(" - ", " – ")}</strong>
          </h3>
          <button
            type="button"
            className="tt-nav-arrow"
            onClick={onNextWeek}
            aria-label="Next week"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
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

      {loading ? <LoadingPanel message="Loading time logs..." /> : <table className="tt-table-grid">
        <thead>
          <tr>
            <th>Day</th>
            <th>Clocked In (Date & Time)</th>
            <th>Clocked Out (Date & Time)</th>
            <th>Hours</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {weekRows.map((row) => (
            <tr key={row.id}>
              {/* Day */}
              <td className={`tt-day-cell-wrap ${row.isToday ? "is-today" : ""}`}>
                <div className="tt-day-cell-line">
                  <span className="tt-day-marker" aria-hidden="true" />
                  <span className="tt-day-cell">{row.dayName}</span>
                  {row.isToday && <span className="tt-today-badge">Today</span>}
                </div>
                <span className="tt-day-date">{row.shortDate}</span>
              </td>

              {/* Clocked In */}
              <td>
                {row.hasData ? (
                  <div className="tt-clock-cell">
                    <span className="tt-clock-value">{row.clockedInDate}</span>
                    <span className="tt-clock-value">{row.clockedInTime}</span>
                  </div>
                ) : (
                  <div className="tt-clock-cell">
                    <span className="tt-clock-value subtle tt-placeholder">--</span>
                    <span className="tt-clock-value subtle tt-placeholder">--</span>
                  </div>
                )}
              </td>

              {/* Clocked Out */}
              <td>
                {row.hasData ? (
                  <div className="tt-clock-cell">
                    <span className="tt-clock-value">{row.clockedOutDate}</span>
                    <span className="tt-clock-value">{row.clockedOutTime}</span>
                  </div>
                ) : (
                  <div className="tt-clock-cell">
                    <span className="tt-clock-value subtle tt-placeholder">--</span>
                    <span className="tt-clock-value subtle tt-placeholder">--</span>
                  </div>
                )}
              </td>

              {/* Hours */}
              <td>
                {row.hasData ? (
                  <span className="tt-hours-cell">{Number(row.hours).toFixed(2)}</span>
                ) : (
                  <span className="tt-hours-cell tt-placeholder">--</span>
                )}
              </td>

              {/* Action */}
              <td className="tt-action-cell">
                <button
                  type="button"
                  className="tt-btn-edit"
                  aria-label={`Edit ${row.dayName} log`}
                >
                  <FontAwesomeIcon icon={faPen} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>}
      <div className="tt-table-summary">
        <div className="tt-summary-metrics">
          <div><span>Regular Hours:</span><strong>{totalHours.toFixed(2)} hrs</strong></div>
          <div><span>Overtime:</span><strong className="tt-summary-positive">0.00 hrs</strong></div>
          <div><span>Total Logged:</span><strong>{totalHours.toFixed(2)} hrs</strong></div>
        </div>
        <div className="tt-summary-actions">
          <button type="button" className="tt-btn-draft" disabled>Save as Draft</button>
          <button type="button" className="tt-btn-submit" disabled>Submit Timesheet for Approval</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TimeTrackerView({ initialData }) {
  const permissions = useMemo(
    () => getTimeTrackerPermissions(initialData?.roles, initialData?.orgRoles),
    [initialData?.roles, initialData?.orgRoles],
  );
  const {
    currentTime,
    activeNav,
    setActiveNav,
    navItems,
    weekRange,
    weekRows,
    goPreviousWeek,
    goNextWeek,
    goThisWeek,
    weekOffset,
    weekLoading,
    totalHours,
    clockedIn,
    lastClockIn,
    handleClockToggle,
    toggling,
  } = useLogsPage(initialData, permissions);

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
      />

      {/* Main Content */}
      <main className="tt-main">
        {activeNav === "logs" && (
          <>
            {toggling && <LoadingPanel message={clockedIn ? "Clocking out..." : "Clocking in..."} />}
            <TimeLogTable
              weekRange={weekRange}
              weekRows={weekRows}
              onPrevWeek={goPreviousWeek}
              onNextWeek={goNextWeek}
              onThisWeek={goThisWeek}
              weekOffset={weekOffset}
              loading={weekLoading}
              totalHours={totalHours}
            />
          </>
        )}

        {activeNav === "timesheets" && (
          <div className="tt-page-header">
            <div className="tt-page-header-text">
              <h1 className="tt-page-title">Timesheets</h1>
              <p className="tt-page-subtitle">View, edit, and print employee timesheets. Coming soon.</p>
            </div>
          </div>
        )}

        {activeNav === "approvals" && (
          <div className="tt-page-header">
            <div className="tt-page-header-text">
              <h1 className="tt-page-title">Approvals</h1>
              <p className="tt-page-subtitle">Approve or return submitted timesheets. Coming soon.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}