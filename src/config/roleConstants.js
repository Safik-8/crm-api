// src/config/roleConstants.js
//
// ════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH FOR ALL ROLE + MODULE CONSTANTS
//
// Import this file everywhere you need to reference roles or modules.
// DO NOT hardcode role name strings like "SUPER_ADMIN" anywhere else.
//
// NOTE: The final schema uses role `name` as the identifier (no separate
// `code` field). System role names are fixed and should not be changed.
// ════════════════════════════════════════════════════════════════

// ── ROLE NAMES ───────────────────────────────────────────────────
// These are the `name` values stored in the roles DB table for system roles.
// Used in all business logic checks (e.g. actor.primaryRole === ROLE_NAMES.SUPER_ADMIN)
// System roles (isSystem=true) have their names locked — they cannot be changed.
export const ROLE_NAMES = {
  SUPER_ADMIN    : "SUPER_ADMIN",
  COMPANY_ADMIN  : "COMPANY_ADMIN",
  BRANCH_MANAGER : "BRANCH_MANAGER",
  BDE            : "BDE",
  ISE            : "ISE",
}

// ── ROLE RANKS ───────────────────────────────────────────────────
// Higher rank = more authority.
// Gapped intentionally (100, 80, 60, 40) so custom roles can slot in between.
// Example: A "Senior BDE" custom role could be rank 50.
// Rule: An actor can only create/assign roles with rank < actor.primaryRoleRank
export const ROLE_RANKS = {
  SUPER_ADMIN    : 100,
  COMPANY_ADMIN  : 80,
  BRANCH_MANAGER : 60,
  BDE            : 40,
  ISE            : 40,
}

// ── SYSTEM ROLE NAMES ────────────────────────────────────────────
// These roles are seeded at startup (isSystem = true in DB).
// They cannot be deleted, and their name + rank cannot be changed.
// The Role Management module must enforce this.
export const SYSTEM_ROLE_NAMES = Object.values(ROLE_NAMES)

// ── WHO CAN CREATE WHICH ROLES ───────────────────────────────────
// Rank-based: an actor can only create a role with lower rank than their own.
// This map is used in branch.services.js createUserInBranch()
export const ROLE_CREATION_RULES = {
  [ROLE_NAMES.SUPER_ADMIN]    : [ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.COMPANY_ADMIN, ROLE_NAMES.BRANCH_MANAGER, ROLE_NAMES.BDE, ROLE_NAMES.ISE],
  [ROLE_NAMES.COMPANY_ADMIN]  : [ROLE_NAMES.BRANCH_MANAGER, ROLE_NAMES.BDE, ROLE_NAMES.ISE],
  [ROLE_NAMES.BRANCH_MANAGER] : [ROLE_NAMES.BDE, ROLE_NAMES.ISE],
  [ROLE_NAMES.BDE]            : [],
  [ROLE_NAMES.ISE]            : [],
}

// ── ROLES THAT REQUIRE A BRANCH ASSIGNMENT ────────────────────────
// When creating a user with one of these roles, branchId is mandatory.
export const ROLES_NEEDING_BRANCH = [
  ROLE_NAMES.BRANCH_MANAGER,
  ROLE_NAMES.BDE,
  ROLE_NAMES.ISE,
]

// ── CRM MODULES ──────────────────────────────────────────────────
// Full list of permission modules used in the permission matrix.
// The Permission Management module should use this list to build its matrix UI.
export const MODULES = [
  "SYSTEM_SETTINGS",
  "COMPANY",
  "BRANCH",
  "ROLE_PERMISSION",
  "USER",
  "TEAM",
  "LEAD",
  "LEAD_ASSIGNMENT",
  "PIPELINE",
  "TASK",
  "ACTIVITY",
  "COURSE",
  "TARGET",
  "CUSTOMER",
  "APPROVAL",
  "DASHBOARD",
  "REPORT",
  "NOTIFICATION",
  "AUDIT",
]

// ── PERMISSION ACTIONS ───────────────────────────────────────────
// The boolean columns that exist on the `permissions` DB table.
export const PERMISSION_ACTIONS = ["canView", "canCreate", "canEdit", "canDelete", "canArchive"]
