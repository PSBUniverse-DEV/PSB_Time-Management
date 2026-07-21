/**
 * Client Helpers — timeTracker.data.js
 *
 * Constants, mock data, column definitions, filter configs,
 * and display helpers for the Time Tracker module.
 *
 * NOTE: No JSX here — all render functions go in TimeTrackerView.jsx
 */

// ─── Departments ─────────────────────────────────────────────
export const DEPARTMENTS = [
  { id: "eng", name: "Engineering", color: "#3b82f6" },
  { id: "mkt", name: "Marketing", color: "#8b5cf6" },
  { id: "des", name: "Design", color: "#ec4899" },
  { id: "sal", name: "Sales", color: "#f59e0b" },
  { id: "hr",  name: "HR",         color: "#10b981" },
  { id: "fin", name: "Finance",    color: "#06b6d4" },
];

// ─── Employees ───────────────────────────────────────────────
export const EMPLOYEES = [
  { id: "emp-01", name: "Sarah Chen",     dept: "eng", role: "Senior Developer",  avatar: "SC" },
  { id: "emp-02", name: "John Doe",       dept: "eng", role: "Developer",         avatar: "JD" },
  { id: "emp-03", name: "Emma Williams",  dept: "mkt", role: "Marketing Lead",    avatar: "EW" },
  { id: "emp-04", name: "Michael Brown",  dept: "des", role: "UI/UX Designer",    avatar: "MB" },
  { id: "emp-05", name: "Lisa Garcia",    dept: "sal", role: "Sales Manager",     avatar: "LG" },
  { id: "emp-06", name: "James Wilson",   dept: "hr",  role: "HR Coordinator",    avatar: "JW" },
  { id: "emp-07", name: "Emily Davis",    dept: "fin", role: "Finance Analyst",   avatar: "ED" },
  { id: "emp-08", name: "David Lee",      dept: "eng", role: "DevOps Engineer",   avatar: "DL" },
  { id: "emp-09", name: "Anna Martinez",  dept: "mkt", role: "Content Strategist", avatar: "AM" },
  { id: "emp-10", name: "Robert Taylor",  dept: "des", role: "Product Designer",  avatar: "RT" },
  { id: "emp-11", name: "Jennifer Kim",   dept: "sal", role: "Account Executive", avatar: "JK" },
  { id: "emp-12", name: "Thomas Anderson",dept: "eng", role: "Tech Lead",         avatar: "TA" },
];

// ─── Attendance Statuses ─────────────────────────────────────
export const ATTENDANCE_STATUS = {
  PRESENT:  "present",
  LATE:     "late",
  ABSENT:   "absent",
  ON_LEAVE: "on-leave",
  HOLIDAY:  "holiday",
};

export const STATUS_CONFIG = {
  [ATTENDANCE_STATUS.PRESENT]:  { label: "Present",  color: "#16a34a", bg: "#f0fdf4", dot: "🟢" },
  [ATTENDANCE_STATUS.LATE]:     { label: "Late",     color: "#d97706", bg: "#fffbeb", dot: "🟡" },
  [ATTENDANCE_STATUS.ABSENT]:   { label: "Absent",   color: "#dc2626", bg: "#fef2f2", dot: "🔴" },
  [ATTENDANCE_STATUS.ON_LEAVE]: { label: "On Leave", color: "#2563eb", bg: "#eff6ff", dot: "🔵" },
  [ATTENDANCE_STATUS.HOLIDAY]:  { label: "Holiday",  color: "#7c3aed", bg: "#f5f3ff", dot: "🟣" },
};

// ─── Schedule Shifts ─────────────────────────────────────────
export const SHIFTS = [
  { id: "shift-1", label: "Morning",   start: "08:00", end: "16:00" },
  { id: "shift-2", label: "Afternoon", start: "14:00", end: "22:00" },
  { id: "shift-3", label: "Night",     start: "22:00", end: "06:00" },
  { id: "shift-4", label: "Flexible",  start: "---",   end: "---" },
];

// ─── Corporate Deadline ──────────────────────────────────────
export const DEFAULT_LATE_DEADLINE = "08:15";
export const DEFAULT_GRACE_PERIOD = 15; // minutes

// ─── Mock Attendance Records ─────────────────────────────────
function generateMockAttendance() {
  const today = new Date();
  const records = [];
  const daysToGenerate = 14;

  for (let d = daysToGenerate - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dateStr = date.toISOString().split("T")[0];

    EMPLOYEES.forEach((emp) => {
      const rand = Math.random();
      let status = ATTENDANCE_STATUS.PRESENT;
      let timeIn = null;
      let timeOut = null;
      let durationMinutes = 0;

      if (rand < 0.1) {
        status = ATTENDANCE_STATUS.ABSENT;
      } else if (rand < 0.18) {
        status = ATTENDANCE_STATUS.ON_LEAVE;
      } else if (rand < 0.30) {
        status = ATTENDANCE_STATUS.LATE;
        timeIn = `${String(8 + Math.floor(Math.random() * 2)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
        timeOut = `${String(16 + Math.floor(Math.random() * 3)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
        const inMinutes = parseInt(timeIn.split(":")[0]) * 60 + parseInt(timeIn.split(":")[1]);
        const outMinutes = parseInt(timeOut.split(":")[0]) * 60 + parseInt(timeOut.split(":")[1]);
        durationMinutes = Math.floor((outMinutes - inMinutes) * (0.8 + Math.random() * 0.4));
      } else {
        status = ATTENDANCE_STATUS.PRESENT;
        const hour = 7 + Math.floor(Math.random() * 2);
        const min = Math.floor(Math.random() * 60);
        timeIn = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        timeOut = `${String(16 + Math.floor(Math.random() * 3)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
        const inMinutes = parseInt(timeIn.split(":")[0]) * 60 + parseInt(timeIn.split(":")[1]);
        const outMinutes = parseInt(timeOut.split(":")[0]) * 60 + parseInt(timeOut.split(":")[1]);
        durationMinutes = Math.floor((outMinutes - inMinutes) * (0.8 + Math.random() * 0.4));
      }

      records.push({
        id: `att-${emp.id}-${dateStr}`,
        employeeId: emp.id,
        date: dateStr,
        timeIn,
        timeOut,
        durationMinutes: Math.max(0, Math.min(durationMinutes, 600)),
        status,
        notes: status === ATTENDANCE_STATUS.LATE ? "Arrived after deadline" : "",
      });
    });
  }

  return records;
}

export const MOCK_ATTENDANCE = generateMockAttendance();

// ─── Schedule Mock Data ──────────────────────────────────────
export const MOCK_SCHEDULE = (() => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  const schedule = [];
  const shiftPool = ["shift-1", "shift-1", "shift-1", "shift-2", "shift-1"];

  EMPLOYEES.forEach((emp) => {
    for (let i = 0; i < 5; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      if (Math.random() > 0.15) {
        schedule.push({
          id: `sch-${emp.id}-${dateStr}`,
          employeeId: emp.id,
          date: dateStr,
          shiftId: shiftPool[i % shiftPool.length],
          notes: "",
        });
      }
    }
  });

  return schedule;
})();

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

/** Get employee object by id */
export function getEmployee(id) {
  return EMPLOYEES.find((e) => e.id === id) || { id, name: id, dept: "", role: "", avatar: "??" };
}

/** Get department object by id */
export function getDepartment(id) {
  return DEPARTMENTS.find((d) => d.id === id) || { id, name: id, color: "#6b7280" };
}

/** Map raw attendance record to display row (pure data, no JSX) */
export function mapAttendanceRow(record) {
  const emp = getEmployee(record.employeeId);
  const dept = getDepartment(emp.dept);
  const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.present;

  return {
    ...record,
    employeeName: emp.name,
    employeeAvatar: emp.avatar,
    department: dept.name,
    departmentColor: dept.color,
    departmentId: emp.dept,
    timeInFormatted: formatTime(record.timeIn),
    timeOutFormatted: formatTime(record.timeOut),
    durationFormatted: formatDuration(record.durationMinutes),
    durationDecimal: formatDecimalHours(record.durationMinutes),
    statusLabel: statusConfig.label,
    statusColor: statusConfig.color,
    statusBg: statusConfig.bg,
    statusDot: statusConfig.dot,
    dateFormatted: formatDate(record.date),
  };
}

/** Map all attendance records */
export function mapAttendanceRows(records) {
  return (records || []).map(mapAttendanceRow);
}

// ─── Column Definitions (data only, no JSX renders) ─────────

export const ATTENDANCE_COLUMN_DEFS = [
  { key: "employeeName", label: "Employee", width: 180, minWidth: 140, sortable: true },
  { key: "dateFormatted", label: "Date", width: 120, minWidth: 100, sortable: true },
  { key: "timeInFormatted", label: "Time In", width: 100, minWidth: 80, sortable: true, align: "center" },
  { key: "timeOutFormatted", label: "Time Out", width: 100, minWidth: 80, sortable: true, align: "center" },
  { key: "durationFormatted", label: "Duration", width: 100, minWidth: 80, sortable: true, align: "center" },
  { key: "status", label: "Status", width: 120, minWidth: 100, sortable: true, align: "center" },
];

// ─── TableZ Filter Config ────────────────────────────────────
import { createFilterConfig, TABLE_FILTER_TYPES } from "@/shared/components/ui/table/filterSchema";

export const ATTENDANCE_FILTER_CONFIG = createFilterConfig([
  {
    key: "dateRange",
    label: "Date Range",
    type: TABLE_FILTER_TYPES.DATERANGE,
    placeholder: "Filter by date range",
  },
  {
    key: "department",
    label: "Department",
    type: TABLE_FILTER_TYPES.SELECT,
    placeholder: "All Departments",
    options: DEPARTMENTS.map((d) => ({ value: d.id, label: d.name })),
  },
  {
    key: "status",
    label: "Status",
    type: TABLE_FILTER_TYPES.SELECT,
    placeholder: "All Statuses",
    options: Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({
      value,
      label: `${cfg.dot} ${cfg.label}`,
    })),
  },
]);

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

// ─── Compute Dashboard Metrics ───────────────────────────────

export function computeDashboardMetrics(records, employees) {
  const totalEmployees = employees.length;
  const today = new Date().toISOString().split("T")[0];
  const todayRecords = records.filter((r) => r.date === today);

  const presentToday = todayRecords.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length;
  const lateToday = todayRecords.filter((r) => r.status === ATTENDANCE_STATUS.LATE).length;
  const absentToday = todayRecords.filter((r) => r.status === ATTENDANCE_STATUS.ABSENT).length;
  const checkedIn = presentToday + lateToday;

  const totalDuration = todayRecords.reduce((sum, r) => sum + (r.durationMinutes || 0), 0);
  const avgHours = checkedIn > 0 ? totalDuration / checkedIn : 0;
  const checkInRate = totalEmployees > 0 ? Math.round((checkedIn / totalEmployees) * 100) : 0;

  const deptMetrics = DEPARTMENTS.map((dept) => {
    const deptEmps = employees.filter((e) => e.dept === dept.id);
    const deptRecords = todayRecords.filter((r) => deptEmps.some((e) => e.id === r.employeeId));
    const deptDuration = deptRecords.reduce((sum, r) => sum + (r.durationMinutes || 0), 0);
    const deptCheckedIn = deptRecords.filter((r) =>
      r.status === ATTENDANCE_STATUS.PRESENT || r.status === ATTENDANCE_STATUS.LATE
    ).length;
    const deptAvg = deptCheckedIn > 0 ? deptDuration / deptCheckedIn : 0;

    return {
      ...dept,
      employeeCount: deptEmps.length,
      checkedIn: deptCheckedIn,
      avgHours: deptAvg,
      avgHoursFormatted: formatDecimalHours(deptAvg),
      barPercent: Math.min(100, Math.round((deptCheckedIn / Math.max(deptEmps.length, 1)) * 100)),
    };
  });

  return {
    avgHours: formatDecimalHours(avgHours),
    avgHoursRaw: avgHours,
    activeHeadcount: `${checkedIn}/${totalEmployees}`,
    activeCount: checkedIn,
    totalEmployees,
    checkInRate,
    lateCount: lateToday,
    absentCount: absentToday,
    deptMetrics,
    todayDate: formatDate(today),
  };
}

// ─── Schedule Helpers ────────────────────────────────────────

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function getWeekDates() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);

  return WEEKDAYS.map((day, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return {
      day,
      date: date.getDate(),
      dateStr: date.toISOString().split("T")[0],
      isToday: date.toISOString().split("T")[0] === today.toISOString().split("T")[0],
    };
  });
}

export function getShiftById(id) {
  return SHIFTS.find((s) => s.id === id) || SHIFTS[0];
}