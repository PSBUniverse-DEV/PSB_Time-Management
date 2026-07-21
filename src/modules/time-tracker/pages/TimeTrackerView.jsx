/**
 * Client Component — TimeTrackerView.jsx
 *
 * Main Time Tracker UI with tab-based navigation:
 *   Dashboard | Attendance Logs | Schedule | Settings
 *
 * Features:
 *   - Live clock with real-time ticking
 *   - Identity switcher (simulate different employees)
 *   - Punch terminal (check-in / check-out)
 *   - Department metric cards & bar graphs
 *   - Attendance logs with TableZ, filters, search, export
 *   - Weekly schedule grid planner
 *   - Rules & configuration panel
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Form, Dropdown as BsDropdown } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock, faDownload, faPrint,
  faBuilding, faGear, faChartBar, faUsers,
  faHourglassHalf, faExclamationTriangle, faChevronDown,
  faArrowRightFromBracket, faArrowRightToBracket,
  faChartSimple, faTable, faCalendarWeek, faSliders,
  faFilter, faStop,
} from "@fortawesome/free-solid-svg-icons";

// Shared UI components
import { Button, Card, Modal, TableZ, Input, toastSuccess, toastError } from "@/shared/components/ui";

// Module data & actions
import {
  EMPLOYEES, DEPARTMENTS, SHIFTS,
  ATTENDANCE_FILTER_CONFIG,
  mapAttendanceRows, computeDashboardMetrics,
  formatDate, getEmployee, getDepartment,
  getWeekDates, getShiftById,
  DEFAULT_LATE_DEADLINE, DEFAULT_GRACE_PERIOD,
} from "../data/timeTracker.data";

import { loadTimeTrackerData, clockIn, clockOut, updateAttendanceRecord, deleteAttendanceRecord, saveSchedule, updateConfig } from "../data/timeTracker.actions";

// Module styles
import "../timeTracker.css";

// ─── Unused import cleanup ───────────────────────────────────
// (ATTENDANCE_COLUMN_DEFS, ATTENDANCE_STATUS, STATUS_CONFIG, MOCK_SCHEDULE, WEEKDAYS not needed in View)

// ═══════════════════════════════════════════════════════════════
// HOOK: useTimeTracker
// ═══════════════════════════════════════════════════════════════

function useTimeTracker() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [attendance, setAttendance] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [employees] = useState(EMPLOYEES);
  const [departments] = useState(DEPARTMENTS);
  const [loading, setLoading] = useState(true);

  // Identity switcher
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("emp-01");
  const selectedEmployee = useMemo(
    () => getEmployee(selectedEmployeeId),
    [selectedEmployeeId],
  );

  // Punch terminal
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [sessionStart, setSessionStart] = useState(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [currentRecordId, setCurrentRecordId] = useState(null);

  // Live clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Settings
  const [lateDeadline, setLateDeadline] = useState(DEFAULT_LATE_DEADLINE);
  const [gracePeriod, setGracePeriod] = useState(DEFAULT_GRACE_PERIOD);

  // Dialog
  const [dialog, setDialog] = useState({ kind: null, target: null });

  // Load data
  useEffect(() => {
    async function fetchData() {
      try {
        const data = await loadTimeTrackerData();
        setAttendance(data.attendance || []);
        setSchedule(data.schedule || []);
        setLateDeadline(data.config?.lateDeadline || DEFAULT_LATE_DEADLINE);
        setGracePeriod(data.config?.gracePeriod || DEFAULT_GRACE_PERIOD);
      } catch (err) {
        toastError("Failed to load time tracker data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Live clock tick
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Session timer tick
  useEffect(() => {
    if (!isClockedIn || !sessionStart) return;
    const interval = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isClockedIn, sessionStart]);

  // Format session elapsed time
  const sessionFormatted = useMemo(() => {
    if (!isClockedIn) return "00:00:00";
    const h = Math.floor(sessionElapsed / 3600);
    const m = Math.floor((sessionElapsed % 3600) / 60);
    const s = sessionElapsed % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [isClockedIn, sessionElapsed]);

  // Compute dashboard metrics
  const metrics = useMemo(
    () => computeDashboardMetrics(attendance, employees),
    [attendance, employees],
  );

  // Mapped attendance rows for TableZ
  const attendanceRows = useMemo(() => mapAttendanceRows(attendance), [attendance]);

  // Check if current employee is late
  const isLate = useMemo(() => {
    if (!isClockedIn) return false;
    const now = currentTime;
    const [dlH, dlM] = (lateDeadline || "08:15").split(":").map(Number);
    const deadline = new Date(now);
    deadline.setHours(dlH, dlM, 0, 0);
    return now > deadline;
  }, [isClockedIn, currentTime, lateDeadline]);

  // Punch terminal handlers
  const handleClockIn = useCallback(async () => {
    try {
      const result = await clockIn(selectedEmployeeId);
      if (result.success) {
        setIsClockedIn(true);
        setSessionStart(Date.now());
        setSessionElapsed(0);
        setCurrentRecordId(result.record.id);
        setAttendance((prev) => [result.record, ...prev]);
        toastSuccess(`${selectedEmployee.name} checked in successfully.`, "Punch Terminal");
      }
    } catch (err) {
      toastError("Failed to clock in.");
    }
  }, [selectedEmployeeId, selectedEmployee.name]);

  const handleClockOut = useCallback(async () => {
    try {
      const result = await clockOut(selectedEmployeeId, currentRecordId);
      if (result.success) {
        setIsClockedIn(false);
        setSessionStart(null);
        setSessionElapsed(0);
        setAttendance((prev) =>
          prev.map((r) =>
            r.id === currentRecordId ? { ...r, timeOut: result.timeOut } : r,
          ),
        );
        toastSuccess(`${selectedEmployee.name} checked out successfully.`, "Punch Terminal");
        setCurrentRecordId(null);
      }
    } catch (err) {
      toastError("Failed to clock out.");
    }
  }, [selectedEmployeeId, selectedEmployee.name, currentRecordId]);

  // Attendance actions
  const handleEditAttendance = useCallback((row) => {
    setDialog({ kind: "edit-attendance", target: row });
  }, []);

  const handleDeleteAttendance = useCallback(async (row) => {
    try {
      await deleteAttendanceRecord(row.id);
      setAttendance((prev) => prev.filter((r) => r.id !== row.id));
      toastSuccess("Attendance record deleted.", "Delete");
    } catch (err) {
      toastError("Failed to delete record.");
    }
  }, []);

  const handleSaveAttendanceEdit = useCallback(async (formData) => {
    try {
      await updateAttendanceRecord(formData.id, formData);
      setAttendance((prev) =>
        prev.map((r) => (r.id === formData.id ? { ...r, ...formData } : r)),
      );
      setDialog({ kind: null, target: null });
      toastSuccess("Attendance record updated.", "Edit");
    } catch (err) {
      toastError("Failed to update record.");
    }
  }, []);

  // Schedule handlers
  const [scheduleChanges, setScheduleChanges] = useState([]);

  const handleScheduleChange = useCallback((employeeId, dateStr, shiftId) => {
    setSchedule((prev) => {
      const existing = prev.find((s) => s.employeeId === employeeId && s.date === dateStr);
      if (existing) {
        return prev.map((s) =>
          s.employeeId === employeeId && s.date === dateStr
            ? { ...s, shiftId }
            : s,
        );
      }
      return [
        ...prev,
        { id: `sch-${employeeId}-${dateStr}-new`, employeeId, date: dateStr, shiftId, notes: "" },
      ];
    });
    setScheduleChanges((prev) => [
      ...prev.filter(
        (c) => !(c.employeeId === employeeId && c.date === dateStr),
      ),
      { employeeId, date: dateStr, shiftId },
    ]);
  }, []);

  const handleSaveSchedule = useCallback(async () => {
    try {
      await saveSchedule(scheduleChanges);
      setScheduleChanges([]);
      toastSuccess(`Saved ${scheduleChanges.length} schedule changes.`, "Schedule");
    } catch (err) {
      toastError("Failed to save schedule.");
    }
  }, [scheduleChanges]);

  // Settings handlers
  const handleSaveSettings = useCallback(async () => {
    try {
      await updateConfig({ lateDeadline, gracePeriod });
      toastSuccess("Configuration saved.", "Settings");
    } catch (err) {
      toastError("Failed to save configuration.");
    }
  }, [lateDeadline, gracePeriod]);

  // CSV Export
  const handleExportCSV = useCallback(() => {
    const headers = ["Employee", "Date", "Time In", "Time Out", "Duration", "Status"];
    const rows = attendanceRows.map((r) => [
      r.employeeName,
      r.date,
      r.timeIn || "",
      r.timeOut || "",
      r.durationFormatted,
      r.statusLabel,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastSuccess("CSV exported successfully.", "Export");
  }, [attendanceRows]);

  // PDF Print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return {
    activeTab, setActiveTab,
    attendance, attendanceRows,
    schedule, employees, departments,
    loading, metrics,
    selectedEmployee, selectedEmployeeId, setSelectedEmployeeId,
    currentTime,
    isClockedIn, sessionFormatted, isLate,
    handleClockIn, handleClockOut,
    dialog, setDialog,
    handleEditAttendance, handleDeleteAttendance, handleSaveAttendanceEdit,
    scheduleChanges, handleScheduleChange, handleSaveSchedule,
    lateDeadline, setLateDeadline, gracePeriod, setGracePeriod,
    handleSaveSettings,
    handleExportCSV, handlePrint,
  };
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── Header ──────────────────────────────────────────────────

function TimeTrackerHeader({
  currentTime,
  selectedEmployee,
  selectedEmployeeId,
  onEmployeeChange,
}) {
  const timeStr = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const secondsStr = String(currentTime.getSeconds()).padStart(2, "0");
  const dateStr = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="tt-header">
      <div className="tt-header-left">
        <div className="tt-header-icon">
          <FontAwesomeIcon icon={faClock} />
        </div>
        <div>
          <h1 className="tt-header-title">Time Tracker</h1>
          <div className="tt-header-sub">Attendance & Time Management</div>
        </div>
      </div>

      <div className="tt-header-right">
        <div className="text-end">
          <div className="tt-live-clock">
            {timeStr}
            <span className="tt-live-clock-seconds">{secondsStr}</span>
          </div>
          <div className="tt-header-date">{dateStr}</div>
        </div>

        <BsDropdown align="end">
          <BsDropdown.Toggle as="div" className="tt-identity-switcher" id="identity-dropdown">
            <span
              className="tt-avatar"
              style={{ backgroundColor: getDepartment(selectedEmployee.dept).color }}
            >
              {selectedEmployee.avatar}
            </span>
            <div className="tt-identity-info">
              <div className="tt-identity-name">{selectedEmployee.name}</div>
              <div className="tt-identity-role">{selectedEmployee.role}</div>
            </div>
            <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, color: "#6b7b93" }} />
          </BsDropdown.Toggle>

          <BsDropdown.Menu className="tt-identity-dropdown">
            <BsDropdown.Header style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Switch Employee
            </BsDropdown.Header>
            {EMPLOYEES.map((emp) => (
              <BsDropdown.Item
                key={emp.id}
                as="button"
                className={`tt-identity-dropdown-item ${emp.id === selectedEmployeeId ? "is-active" : ""}`}
                onClick={() => onEmployeeChange(emp.id)}
              >
                <span
                  className="tt-avatar"
                  style={{ backgroundColor: getDepartment(emp.dept).color, width: 28, height: 28, minWidth: 28, fontSize: 10 }}
                >
                  {emp.avatar}
                </span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{emp.name}</div>
                  <div style={{ fontSize: 10, color: "#6b7b93" }}>{emp.role}</div>
                </div>
              </BsDropdown.Item>
            ))}
          </BsDropdown.Menu>
        </BsDropdown>
      </div>
    </div>
  );
}

// ─── Tab Navigation ──────────────────────────────────────────

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: faChartSimple },
  { key: "logs", label: "Attendance Logs", icon: faTable },
  { key: "schedule", label: "Schedule", icon: faCalendarWeek },
  { key: "settings", label: "Settings", icon: faSliders },
];

function TabNav({ activeTab, onTabChange }) {
  return (
    <div className="tt-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`tt-tab ${activeTab === tab.key ? "active" : ""}`}
          onClick={() => onTabChange(tab.key)}
        >
          <FontAwesomeIcon icon={tab.icon} className="tt-tab-icon" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Metric Cards ────────────────────────────────────────────

function MetricCards({ metrics }) {
  const cards = [
    {
      label: "Avg Hours",
      value: metrics.avgHours,
      icon: faHourglassHalf,
      color: "#3b82f6",
      change: "+0.3h vs last week",
      trend: "up",
    },
    {
      label: "Active Headcount",
      value: metrics.activeHeadcount,
      icon: faUsers,
      color: "#10b981",
      change: `${metrics.checkInRate}% check-in rate`,
      trend: "up",
    },
    {
      label: "Check-in Rate",
      value: `${metrics.checkInRate}%`,
      icon: faChartBar,
      color: "#8b5cf6",
      change: `${metrics.activeCount} of ${metrics.totalEmployees} checked in`,
      trend: metrics.checkInRate >= 75 ? "up" : "down",
    },
    {
      label: "Late Today",
      value: metrics.lateCount,
      icon: faExclamationTriangle,
      color: "#f59e0b",
      change: `${metrics.absentCount} absent`,
      trend: metrics.lateCount <= 2 ? "up" : "down",
    },
  ];

  return (
    <div className="tt-metrics">
      {cards.map((card) => (
        <div key={card.label} className="tt-metric-card">
          <div className="tt-metric-header">
            <span className="tt-metric-label">{card.label}</span>
            <span
              className="tt-metric-icon"
              style={{ backgroundColor: card.color }}
            >
              <FontAwesomeIcon icon={card.icon} />
            </span>
          </div>
          <div className="tt-metric-value">{card.value}</div>
          <div className={`tt-metric-change ${card.trend}`}>{card.change}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Department Bar Graph ────────────────────────────────────

function DepartmentBars({ deptMetrics }) {
  const maxBar = useMemo(
    () => Math.max(...deptMetrics.map((d) => d.barPercent), 1),
    [deptMetrics],
  );

  return (
    <div className="tt-dept-bars">
      <div className="tt-dept-bars-title">
        <FontAwesomeIcon icon={faBuilding} className="me-2" style={{ color: "#6b7b93" }} />
        Department Presence
      </div>
      {deptMetrics.map((dept) => (
        <div key={dept.id} className="tt-dept-bar-row">
          <span className="tt-dept-bar-label">{dept.name}</span>
          <div className="tt-dept-bar-track">
            <div
              className="tt-dept-bar-fill"
              style={{
                width: `${(dept.barPercent / maxBar) * 100}%`,
                backgroundColor: dept.color,
              }}
            >
              <span className="tt-dept-bar-value">
                {dept.checkedIn}/{dept.employeeCount}
              </span>
            </div>
          </div>
          <span className="tt-dept-bar-meta">{dept.avgHoursFormatted} avg</span>
        </div>
      ))}
    </div>
  );
}

// ─── Punch Terminal ──────────────────────────────────────────

function PunchTerminal({
  currentTime,
  selectedEmployee,
  isClockedIn,
  sessionFormatted,
  isLate,
  onClockIn,
  onClockOut,
}) {
  const timeStr = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateStr = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="tt-punch-terminal">
      <div className="tt-punch-clock">
        {timeStr}
      </div>
      <div className="tt-punch-date">{dateStr}</div>

      <div className={`tt-punch-session ${isClockedIn ? "active" : ""}`}>
        {isClockedIn && <span className="tt-punch-session-dot" />}
        <FontAwesomeIcon icon={isClockedIn ? faStop : faClock} />
        <span className="tt-mono">
          {isClockedIn ? `Session: ${sessionFormatted}` : "Not clocked in"}
        </span>
      </div>

      <div className="tt-punch-employee">
        <span
          className="tt-avatar me-2"
          style={{ backgroundColor: getDepartment(selectedEmployee.dept).color }}
        >
          {selectedEmployee.avatar}
        </span>
        {selectedEmployee.name}
      </div>

      {isClockedIn ? (
        <button
          type="button"
          className="tt-punch-btn check-out"
          onClick={onClockOut}
        >
          <FontAwesomeIcon icon={faArrowRightFromBracket} />
          Check Out
        </button>
      ) : (
        <button
          type="button"
          className="tt-punch-btn check-in"
          onClick={onClockIn}
        >
          <FontAwesomeIcon icon={faArrowRightToBracket} />
          Check In
        </button>
      )}

      {isClockedIn && (
        <div className={`tt-punch-status ${isLate ? "late" : "on-time"}`}>
          {isLate ? "⚠ Late" : "✅ On Time"}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────

function DashboardTab({ metrics, currentTime, selectedEmployee, isClockedIn, sessionFormatted, isLate, onClockIn, onClockOut }) {
  return (
    <div>
      <MetricCards metrics={metrics} />
      <div className="tt-dashboard-grid">
        <div>
          <DepartmentBars deptMetrics={metrics.deptMetrics} />
        </div>
        <div>
          <PunchTerminal
            currentTime={currentTime}
            selectedEmployee={selectedEmployee}
            isClockedIn={isClockedIn}
            sessionFormatted={sessionFormatted}
            isLate={isLate}
            onClockIn={onClockIn}
            onClockOut={onClockOut}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Attendance Logs Tab ─────────────────────────────────────

function AttendanceLogsTab({
  attendanceRows,
  onEdit,
  onDelete,
  onExportCSV,
  onPrint,
}) {
  const columns = useMemo(
    () => [
      {
        key: "employeeName",
        label: "Employee",
        width: 180,
        minWidth: 140,
        sortable: true,
        render: (row) => (
          <div className="d-flex align-items-center gap-2">
            <span
              className="tt-avatar"
              style={{ backgroundColor: row.departmentColor || "#6b7280" }}
            >
              {row.employeeAvatar || "??"}
            </span>
            <div>
              <div className="fw-semibold tt-name">{row.employeeName}</div>
              <div className="tt-dept-label">{row.department}</div>
            </div>
          </div>
        ),
      },
      {
        key: "dateFormatted",
        label: "Date",
        width: 120,
        minWidth: 100,
        sortable: true,
      },
      {
        key: "timeInFormatted",
        label: "Time In",
        width: 100,
        minWidth: 80,
        sortable: true,
        align: "center",
        render: (row) => (
          <span className="tt-mono">{row.timeInFormatted}</span>
        ),
      },
      {
        key: "timeOutFormatted",
        label: "Time Out",
        width: 100,
        minWidth: 80,
        sortable: true,
        align: "center",
        render: (row) => (
          <span className="tt-mono">{row.timeOutFormatted}</span>
        ),
      },
      {
        key: "durationFormatted",
        label: "Duration",
        width: 100,
        minWidth: 80,
        sortable: true,
        align: "center",
        render: (row) => (
          <span className="tt-mono fw-semibold">{row.durationFormatted}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: 120,
        minWidth: 100,
        sortable: true,
        align: "center",
        render: (row) => (
          <span
            className="tt-status-badge"
            style={{
              color: row.statusColor,
              backgroundColor: row.statusBg,
              borderColor: row.statusColor + "33",
            }}
          >
            <span className="tt-status-dot">{row.statusDot}</span>
            {row.statusLabel}
          </span>
        ),
      },
    ],
    [],
  );

  const actions = useMemo(
    () => [
      {
        key: "edit",
        label: "Edit",
        type: "secondary",
        icon: "pen",
        onClick: (row) => onEdit(row),
      },
      {
        key: "delete",
        label: "Delete",
        type: "danger",
        icon: "trash",
        confirm: true,
        confirmMessage: () => "Delete this attendance record?",
        onClick: (row) => onDelete(row),
      },
    ],
    [onEdit, onDelete],
  );

  return (
    <div>
      <div className="tt-logs-toolbar">
        <div className="tt-logs-filters">
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7b93", display: "flex", alignItems: "center", gap: 4 }}>
            <FontAwesomeIcon icon={faFilter} />
            Filters
          </span>
        </div>
        <div className="tt-logs-actions">
          <button type="button" className="tt-export-btn" onClick={onExportCSV}>
            <FontAwesomeIcon icon={faDownload} />
            CSV
          </button>
          <button type="button" className="tt-export-btn" onClick={onPrint}>
            <FontAwesomeIcon icon={faPrint} />
            Print
          </button>
        </div>
      </div>

      <Card title="Attendance Records" subtitle="Daily time logs and status">
        <TableZ
          columns={columns}
          data={attendanceRows}
          rowIdKey="id"
          actions={actions}
          filterConfig={ATTENDANCE_FILTER_CONFIG}
          emptyMessage="No attendance records found."
          searchPlaceholder="Search by name, date, status..."
        />
      </Card>
    </div>
  );
}

// ─── Schedule Tab ────────────────────────────────────────────

function ScheduleTab({ schedule, employees, onScheduleChange, onSaveSchedule, scheduleChanges }) {
  const weekDates = useMemo(() => getWeekDates(), []);

  const getEmployeeShift = useCallback(
    (employeeId, dateStr) => {
      const entry = schedule.find(
        (s) => s.employeeId === employeeId && s.date === dateStr,
      );
      return entry ? getShiftById(entry.shiftId) : null;
    },
    [schedule],
  );

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0" style={{ color: "#131b2e", fontWeight: 700 }}>
          <FontAwesomeIcon icon={faCalendarWeek} className="me-2" style={{ color: "#6b7b93" }} />
          Weekly Schedule
        </h5>
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={onSaveSchedule}
          disabled={scheduleChanges.length === 0}
        >
          Save Changes {scheduleChanges.length > 0 ? `(${scheduleChanges.length})` : ""}
        </Button>
      </div>

      <div className="tt-schedule-wrapper">
        <div className="tt-schedule-grid">
          {/* Header row */}
          <div className="tt-schedule-header-cell">Employee</div>
          {weekDates.map((wd) => (
            <div
              key={wd.dateStr}
              className={`tt-schedule-header-cell ${wd.isToday ? "is-today" : ""}`}
            >
              <div>{wd.day.slice(0, 3)}</div>
              <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.7 }}>
                {wd.dateStr}
              </div>
            </div>
          ))}

          {/* Employee rows */}
          {employees.map((emp) => (
            <div key={emp.id} className="tt-schedule-row">
              <div className="tt-schedule-cell employee-cell">
                <span
                  className="tt-avatar"
                  style={{ backgroundColor: getDepartment(emp.dept).color, width: 26, height: 26, minWidth: 26, fontSize: 9 }}
                >
                  {emp.avatar}
                </span>
                <span style={{ fontSize: 12 }}>{emp.name}</span>
              </div>
              {weekDates.map((wd) => {
                const shift = getEmployeeShift(emp.id, wd.dateStr);
                return (
                  <div key={wd.dateStr} className="tt-schedule-cell shift-cell">
                    <Form.Select
                      size="sm"
                      value={shift?.id || ""}
                      onChange={(e) => onScheduleChange(emp.id, wd.dateStr, e.target.value)}
                      style={{
                        fontSize: 11,
                        minHeight: 28,
                        height: 28,
                        padding: "0 0.35rem",
                        borderRadius: 6,
                      }}
                    >
                      <option value="">—</option>
                      {SHIFTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────

function SettingsTab({
  lateDeadline,
  gracePeriod,
  onLateDeadlineChange,
  onGracePeriodChange,
  onSave,
}) {
  return (
    <div>
      <div className="tt-settings-section">
        <div className="tt-settings-title">
          <FontAwesomeIcon icon={faGear} className="me-2" style={{ color: "#6b7b93" }} />
          Attendance Rules
        </div>
        <div className="tt-settings-desc">
          Configure corporate deadlines and grace periods for attendance tracking.
        </div>
        <div className="tt-settings-row">
          <div className="tt-settings-field">
            <label>Late Deadline</label>
            <Input
              type="time"
              value={lateDeadline}
              onChange={(e) => onLateDeadlineChange(e.target.value)}
              style={{ width: 140 }}
            />
          </div>
          <div className="tt-settings-field">
            <label>Grace Period (minutes)</label>
            <Input
              type="number"
              min={0}
              max={60}
              value={gracePeriod}
              onChange={(e) => onGracePeriodChange(Number(e.target.value))}
              style={{ width: 100 }}
            />
          </div>
          <div style={{ marginTop: "auto", paddingBottom: 2 }}>
            <Button type="button" size="sm" variant="primary" onClick={onSave}>
              Save Settings
            </Button>
          </div>
        </div>
      </div>

      <div className="tt-settings-section">
        <div className="tt-settings-title">
          <FontAwesomeIcon icon={faClock} className="me-2" style={{ color: "#6b7b93" }} />
          Shift Definitions
        </div>
        <div className="tt-settings-desc">
          Available shift types for schedule planning.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem" }}>
          {SHIFTS.map((shift) => (
            <div
              key={shift.id}
              style={{
                padding: "0.65rem 0.85rem",
                border: "1px solid #e8edf4",
                borderRadius: 8,
                background: "#fafbfc",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#131b2e" }}>{shift.label}</div>
              <div style={{ fontSize: 12, color: "#6b7b93", marginTop: 2 }}>
                {shift.start === "---" ? "Flexible hours" : `${shift.start} – ${shift.end}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Attendance Dialog ──────────────────────────────────

function EditAttendanceDialog({ dialog, onClose, onSave }) {
  const [form, setForm] = useState({ timeIn: "", timeOut: "", notes: "" });

  useEffect(() => {
    if (dialog?.target) {
      setForm({
        timeIn: dialog.target.timeIn || "",
        timeOut: dialog.target.timeOut || "",
        notes: dialog.target.notes || "",
      });
    }
  }, [dialog]);

  if (dialog?.kind !== "edit-attendance") return null;

  const row = dialog.target;
  const emp = getEmployee(row?.employeeId);

  return (
    <Modal show onHide={onClose} title="Edit Attendance Record">
      <div>
        <div className="d-flex align-items-center gap-2 mb-3">
          <span className="tt-avatar" style={{ backgroundColor: getDepartment(emp.dept).color }}>
            {emp.avatar}
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.name}</div>
            <div style={{ fontSize: 12, color: "#6b7b93" }}>{formatDate(row?.date)}</div>
          </div>
        </div>

        <div className="mb-3">
          <Input
            label="Time In"
            type="time"
            value={form.timeIn}
            onChange={(e) => setForm((prev) => ({ ...prev, timeIn: e.target.value }))}
          />
        </div>
        <div className="mb-3">
          <Input
            label="Time Out"
            type="time"
            value={form.timeOut}
            onChange={(e) => setForm((prev) => ({ ...prev, timeOut: e.target.value }))}
          />
        </div>
        <div className="mb-3">
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Optional notes..."
          />
        </div>

        <div className="d-flex justify-content-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSave({ id: row.id, ...form })}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN VIEW (default export)
// ═══════════════════════════════════════════════════════════════

export default function TimeTrackerView() {
  const hook = useTimeTracker();

  if (hook.loading) {
    return (
      <main className="container py-4 tt-theme">
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: 300 }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status" />
            <p className="text-muted" style={{ fontSize: 14 }}>Loading Time Tracker...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container py-4 tt-theme">
      <TimeTrackerHeader
        currentTime={hook.currentTime}
        selectedEmployee={hook.selectedEmployee}
        selectedEmployeeId={hook.selectedEmployeeId}
        onEmployeeChange={hook.setSelectedEmployeeId}
      />

      <TabNav activeTab={hook.activeTab} onTabChange={hook.setActiveTab} />

      {hook.activeTab === "dashboard" && (
        <DashboardTab
          metrics={hook.metrics}
          currentTime={hook.currentTime}
          selectedEmployee={hook.selectedEmployee}
          isClockedIn={hook.isClockedIn}
          sessionFormatted={hook.sessionFormatted}
          isLate={hook.isLate}
          onClockIn={hook.handleClockIn}
          onClockOut={hook.handleClockOut}
        />
      )}

      {hook.activeTab === "logs" && (
        <AttendanceLogsTab
          attendanceRows={hook.attendanceRows}
          onEdit={hook.handleEditAttendance}
          onDelete={hook.handleDeleteAttendance}
          onExportCSV={hook.handleExportCSV}
          onPrint={hook.handlePrint}
        />
      )}

      {hook.activeTab === "schedule" && (
        <ScheduleTab
          schedule={hook.schedule}
          employees={hook.employees}
          onScheduleChange={hook.handleScheduleChange}
          onSaveSchedule={hook.handleSaveSchedule}
          scheduleChanges={hook.scheduleChanges}
        />
      )}

      {hook.activeTab === "settings" && (
        <SettingsTab
          lateDeadline={hook.lateDeadline}
          gracePeriod={hook.gracePeriod}
          onLateDeadlineChange={hook.setLateDeadline}
          onGracePeriodChange={hook.setGracePeriod}
          onSave={hook.handleSaveSettings}
        />
      )}

      <EditAttendanceDialog
        dialog={hook.dialog}
        onClose={() => hook.setDialog({ kind: null, target: null })}
        onSave={hook.handleSaveAttendanceEdit}
      />
    </main>
  );
}