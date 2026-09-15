/**
 * Derive Time Tracker capabilities from app and organization roles.
 */

const TIME_TRACKER_APP_ID = "10";

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

export function getTimeTrackerPermissions(roles, orgRoles) {
  const appRoleNames = new Set(
    (Array.isArray(roles) ? roles : [])
      .filter((role) => role && String(role.app_id) === TIME_TRACKER_APP_ID && role.is_active !== false)
      .map((role) => normalizeName(role.role_name)),
  );

  const isEmployee = appRoleNames.has("employee");
  const isAdmin = appRoleNames.has("admin");
  const isApprover = (Array.isArray(orgRoles) ? orgRoles : []).some(
    (role) => normalizeName(role?.name) === "timesheet approver",
  );

  return {
    isEmployee,
    isAdmin,
    isApprover,
    canViewLogsTab: isEmployee || isAdmin,
    canViewTimesheetsTab: isAdmin,
    canViewApprovalsTab: isApprover,
    canSubmitOwnTimesheet: isEmployee || isAdmin,
    canEditOwnTime: isEmployee || isAdmin,
    canViewOthersTimesheets: isAdmin,
    canEditOthersTimesheets: isAdmin,
    canPrintTimesheets: isAdmin,
    canApproveOrReturn: isApprover,
  };
}
