/**
 * Server Actions — timeTracker.actions.js
 *
 * Server-side data loading functions.
 * Currently returns mock data for development.
 */
"use server";

import {
  MOCK_ATTENDANCE,
  MOCK_SCHEDULE,
  EMPLOYEES,
  DEPARTMENTS,
  DEFAULT_LATE_DEADLINE,
  DEFAULT_GRACE_PERIOD,
} from "./timeTracker.data";

/**
 * Load all time tracker data (attendance records, employees, departments)
 */
export async function loadTimeTrackerData() {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  return {
    attendance: MOCK_ATTENDANCE,
    schedule: MOCK_SCHEDULE,
    employees: EMPLOYEES,
    departments: DEPARTMENTS,
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
  await new Promise((resolve) => setTimeout(resolve, 150));
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
  await new Promise((resolve) => setTimeout(resolve, 150));
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
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { success: true, id, ...data };
}

/**
 * Delete an attendance record
 */
export async function deleteAttendanceRecord(id) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { success: true, id };
}

/**
 * Save schedule assignments
 */
export async function saveSchedule(scheduleChanges) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { success: true, changes: scheduleChanges.length };
}

/**
 * Update configuration (late deadline, grace period)
 */
export async function updateConfig(config) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { success: true, config };
}