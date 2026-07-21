/**
 * Server Actions — timeTracker.actions.js
 *
 * Server-side data loading functions.
 * Kept as stubs for future implementation.
 */
"use server";

import {
  DEFAULT_LATE_DEADLINE,
  DEFAULT_GRACE_PERIOD,
} from "./timeTracker.data";

/**
 * Load all time tracker data (attendance records, employees, departments)
 * TODO: Implement database loading
 */
export async function loadTimeTrackerData() {
  return {
    attendance: [],
    schedule: [],
    employees: [],
    departments: [],
    config: {
      lateDeadline: DEFAULT_LATE_DEADLINE,
      gracePeriod: DEFAULT_GRACE_PERIOD,
    },
  };
}

/**
 * Clock in an employee
 */
export async function clockIn(employeeId) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return {
    success: true,
    record: {
      id: `att-${employeeId}-${now.toISOString().split("T")[0]}`,
      employeeId,
      date: now.toISOString().split("T")[0],
      timeIn: timeStr,
      timeOut: null,
      durationMinutes: 0,
      status: "present",
      notes: "",
    },
  };
}

/**
 * Clock out an employee
 */
export async function clockOut(employeeId, recordId) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return {
    success: true,
    recordId,
    timeOut: timeStr,
  };
}

/**
 * Update an attendance record
 */
export async function updateAttendanceRecord(id, data) {
  return { success: true, id, ...data };
}

/**
 * Delete an attendance record
 */
export async function deleteAttendanceRecord(id) {
  return { success: true, id };
}

/**
 * Save schedule assignments
 */
export async function saveSchedule(scheduleChanges) {
  return { success: true, changes: scheduleChanges.length };
}

/**
 * Update configuration (late deadline, grace period)
 */
export async function updateConfig(config) {
  return { success: true, config };
}