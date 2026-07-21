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

import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faCalendarAlt,
  faChevronLeft,
  faChevronRight,
  faDownload,
  faSearch,
  faPen,
  faGaugeHigh,
  faClockRotateLeft,
  faTable,
  faListCheck,
  faUser,
  faBook,
} from "@fortawesome/free-solid-svg-icons";

// Module styles
import "../timeTracker.css";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: faGaugeHigh },
  { key: "clock", label: "Clock", icon: faClock },
  { key: "logs", label: "Logs", icon: faTable },
  { key: "tasks", label: "Tasks", icon: faListCheck },
  { key: "profile", label: "Profile", icon: faUser },
  { key: "instructions", label: "Instructions", icon: faBook },
];

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// ═══════════════════════════════════════════════════════════════
// HOOK: useLogsPage
// ═══════════════════════════════════════════════════════════════

function useLogsPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeNav, setActiveNav] = useState("logs");
  const [weekOffset, setWeekOffset] = useState(0);

  // Live clock tick
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute week date range for the header
  const weekRange = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    // Get the Monday of the current week (adjusted by weekOffset)
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

  // Generate week rows (7 days, all empty — no mocked data)
  const weekRows = useMemo(() => {
    const monday = weekRange.start;
    return DAYS_OF_WEEK.map((dayName, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return {
        id: `day-${index}`,
        dayName,
        date: dateStr,
        clockedInDate: null,
        clockedInTime: null,
        clockedOutDate: null,
        clockedOutTime: null,
        hours: null,
        hasData: false,
      };
    });
  }, [weekRange]);

  const goPreviousWeek = useCallback(() => {
    setWeekOffset((prev) => prev - 1);
  }, []);

  const goNextWeek = useCallback(() => {
    setWeekOffset((prev) => prev + 1);
  }, []);

  const goThisWeek = useCallback(() => {
    setWeekOffset(0);
  }, []);

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
  };
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── Sidebar ──────────────────────────────────────────────────

function Sidebar({ currentTime, activeNav, onNavChange }) {
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
    <aside className="tt-sidebar">
      {/* Brand */}
      <div className="tt-sidebar-brand">
        <div className="tt-logo">PSB</div>
        <div className="tt-brand-text">
          <div className="tt-brand-title">Time Tracker</div>
          <div className="tt-brand-subtitle">OFFLINE DESKTOP LOGGING</div>
        </div>
      </div>

      {/* Digital Clock */}
      <div className="tt-sidebar-clock-card">
        <div className="tt-sidebar-clock-time">{timeStr}</div>
        <div className="tt-sidebar-clock-date">{dateStr}</div>
      </div>

      {/* Navigation */}
      <nav className="tt-sidebar-nav">
        {NAV_ITEMS.map((item) => (
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
        <div className="tt-sidebar-status-label">NOT CLOCKED IN</div>
        <div className="tt-sidebar-status-meta">Last clock in: 08:59 PM</div>
      </div>
    </aside>
  );
}

// ─── Filter Card ──────────────────────────────────────────────

function FilterCard() {
  return (
    <div className="tt-filter-card">
      <div className="tt-filter-row">
        <div className="tt-filter-group">
          <label className="tt-filter-label">Start Date</label>
          <div className="tt-filter-input-wrapper">
            <FontAwesomeIcon icon={faCalendarAlt} className="tt-filter-input-icon" />
            <input
              type="text"
              className="tt-filter-input"
              placeholder="dd/mm/yyyy"
              readOnly
            />
          </div>
        </div>

        <div className="tt-filter-group">
          <label className="tt-filter-label">End Date</label>
          <div className="tt-filter-input-wrapper">
            <FontAwesomeIcon icon={faCalendarAlt} className="tt-filter-input-icon" />
            <input
              type="text"
              className="tt-filter-input"
              placeholder="dd/mm/yyyy"
              readOnly
            />
          </div>
        </div>

        <button type="button" className="tt-btn-view">
          View
        </button>
      </div>
    </div>
  );
}

// ─── Logs Toolbar ─────────────────────────────────────────────

function LogsToolbar() {
  return (
    <div className="tt-logs-toolbar">
      <button type="button" className="tt-btn-export">
        <FontAwesomeIcon icon={faDownload} />
        Export All Logs
      </button>

      <div className="tt-search-wrapper">
        <FontAwesomeIcon icon={faSearch} className="tt-search-icon" />
        <input
          type="text"
          className="tt-search-input"
          placeholder="Search Clock In Date"
        />
      </div>
    </div>
  );
}

// ─── Time Log Table ───────────────────────────────────────────

function TimeLogTable({ weekRange, weekRows, onPrevWeek, onNextWeek, onThisWeek, weekOffset }) {
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
          <h3 className="tt-table-title">{weekRange.fullLabel}</h3>
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
      </div>

      {/* Table */}
      <table className="tt-table-grid">
        <thead>
          <tr>
            <th>Day</th>
            <th>Clocked In</th>
            <th>Clocked Out</th>
            <th>Hours</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {weekRows.map((row) => (
            <tr key={row.id}>
              {/* Day */}
              <td>
                <span className="tt-day-cell">{row.dayName}</span>
              </td>

              {/* Clocked In */}
              <td>
                {row.hasData ? (
                  <div className="tt-clock-cell">
                    <span className="tt-clock-label">Date Clocked In</span>
                    <span className="tt-clock-value">{row.clockedInDate}</span>
                    <span className="tt-clock-label" style={{ marginTop: "2px" }}>Clock In Time</span>
                    <span className="tt-clock-value">{row.clockedInTime}</span>
                  </div>
                ) : (
                  <div className="tt-clock-cell">
                    <span className="tt-clock-label">Date Clocked In</span>
                    <span className="tt-clock-value subtle tt-placeholder">--</span>
                    <span className="tt-clock-label" style={{ marginTop: "2px" }}>Clock In Time</span>
                    <span className="tt-clock-value subtle tt-placeholder">--</span>
                  </div>
                )}
              </td>

              {/* Clocked Out */}
              <td>
                {row.hasData ? (
                  <div className="tt-clock-cell">
                    <span className="tt-clock-label">Date Clocked Out</span>
                    <span className="tt-clock-value">{row.clockedOutDate}</span>
                    <span className="tt-clock-label" style={{ marginTop: "2px" }}>Clock Out Time</span>
                    <span className="tt-clock-value">{row.clockedOutTime}</span>
                  </div>
                ) : (
                  <div className="tt-clock-cell">
                    <span className="tt-clock-label">Date Clocked Out</span>
                    <span className="tt-clock-value subtle tt-placeholder">--</span>
                    <span className="tt-clock-label" style={{ marginTop: "2px" }}>Clock Out Time</span>
                    <span className="tt-clock-value subtle tt-placeholder">--</span>
                  </div>
                )}
              </td>

              {/* Hours */}
              <td>
                {row.hasData ? (
                  <span className="tt-hours-cell">{row.hours}</span>
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
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TimeTrackerView() {
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
  } = useLogsPage();

  return (
    <div className="tt-app-layout">
      {/* Sidebar */}
      <Sidebar
        currentTime={currentTime}
        activeNav={activeNav}
        onNavChange={setActiveNav}
      />

      {/* Main Content */}
      <main className="tt-main">
        {/* Page Header */}
        <div className="tt-page-header">
          <h1 className="tt-page-title">Logs</h1>
          <p className="tt-page-subtitle">Review and export your time logs.</p>
        </div>

        {/* Filter Card */}
        <FilterCard />

        {/* Toolbar */}
        <LogsToolbar />

        {/* Time Log Table */}
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