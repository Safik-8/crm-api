// src/config/initSystem.js

import prisma from "./db.js"
import { hashPassword } from "../utils/passwordUtils.js"
import {
    ROLE_NAMES,
    ROLE_RANKS,
    MODULES,
} from "./roleConstants.js"
import {
    ensureCompanyCriteriaSeeded,
    batchEnsureCompaniesCriteriaSeeded
} from "../modules/qualification/qualification-settings.service.js"

// ══════════════════════════════════════
// SYSTEM ROLES — seeds on every startup
// name  = role identifier (unique within companyId=null scope)
// rank  = authority level (100=highest) — gapped so custom roles can slot in
// isSystem = true locks rank & name, prevents deletion
// ══════════════════════════════════════
const ROLES = [
    { name: ROLE_NAMES.SUPER_ADMIN, rank: ROLE_RANKS.SUPER_ADMIN, isSystem: true, status: "ACTIVE", description: "Super Admin - Full system access" },
    { name: ROLE_NAMES.COMPANY_ADMIN, rank: ROLE_RANKS.COMPANY_ADMIN, isSystem: true, status: "ACTIVE", description: "Company Admin - Company wide full access" },
    { name: ROLE_NAMES.BRANCH_MANAGER, rank: ROLE_RANKS.BRANCH_MANAGER, isSystem: true, status: "ACTIVE", description: "Branch Manager - Full branch access and approvals" },
    { name: ROLE_NAMES.BDE, rank: ROLE_RANKS.BDE, isSystem: true, status: "ACTIVE", description: "Business Development Executive - Client acquisition and follow-ups" },
    { name: ROLE_NAMES.ISE, rank: ROLE_RANKS.ISE, isSystem: true, status: "ACTIVE", description: "Inside Sales Executive - Support and lead nurture" },
]

// ══════════════════════════════════════
// MODULES
// ══════════════════════════════════════
// MODULES imported from roleConstants.js above


// ══════════════════════════════════════
// PERMISSION MATRIX PER ROLE
// Format: { canView, canCreate, canEdit, canDelete }
// ══════════════════════════════════════
const ROLE_PERMISSIONS = {

    SUPER_ADMIN: {
        SYSTEM_SETTINGS: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        COMPANY: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        BRANCH: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        ROLE_PERMISSION: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        USER: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        TEAM: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD_ASSIGNMENT: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        OPPORTUNITY_PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        FOLLOWUP: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        ACTIVITY: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        COURSE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        TARGET: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        CUSTOMER: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        DEAL: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        APPROVAL: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        REVENUE_REPORT: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        SALES_PERFORMANCE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        NOTIFICATION: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        AUDIT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD_SOURCE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD_STATUS: { canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: false },
        QUALIFICATION: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        OPPORTUNITY: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    },

    COMPANY_ADMIN: {
        SYSTEM_SETTINGS: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        COMPANY: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        BRANCH: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        ROLE_PERMISSION: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        USER: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        TEAM: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD_ASSIGNMENT: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        OPPORTUNITY_PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        FOLLOWUP: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TASK: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        ACTIVITY: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        COURSE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        TARGET: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        CUSTOMER: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        DEAL: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        APPROVAL: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        REVENUE_REPORT: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        SALES_PERFORMANCE: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD_SOURCE: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        LEAD_STATUS: { canView: true, canCreate: true, canEdit: true, canDelete: false, canArchive: false },
        QUALIFICATION: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        OPPORTUNITY: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    },

    BRANCH_MANAGER: {
        SYSTEM_SETTINGS: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        COMPANY: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        BRANCH: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        ROLE_PERMISSION: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        USER: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        TEAM: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD_ASSIGNMENT: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        OPPORTUNITY_PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        FOLLOWUP: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TASK: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        ACTIVITY: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        COURSE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        CUSTOMER: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        DEAL: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        APPROVAL: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        REVENUE_REPORT: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        SALES_PERFORMANCE: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD_SOURCE: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        LEAD_STATUS: { canView: true, canCreate: false, canEdit: false, canDelete: false, canArchive: false },
        QUALIFICATION: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        OPPORTUNITY: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    },

    BDE: {
        SYSTEM_SETTINGS: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        COMPANY: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        BRANCH: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        ROLE_PERMISSION: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        USER: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TEAM: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        LEAD_ASSIGNMENT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        PIPELINE: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        OPPORTUNITY_PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        FOLLOWUP: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        ACTIVITY: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        COURSE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        CUSTOMER: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        DEAL: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        APPROVAL: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        REVENUE_REPORT: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        SALES_PERFORMANCE: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        LEAD_SOURCE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD_STATUS: { canView: true, canCreate: false, canEdit: false, canDelete: false, canArchive: false },
        QUALIFICATION: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        OPPORTUNITY: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    },

    ISE: {
        SYSTEM_SETTINGS: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        COMPANY: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        BRANCH: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        ROLE_PERMISSION: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        USER: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        TEAM: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        LEAD_ASSIGNMENT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        PIPELINE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        OPPORTUNITY_PIPELINE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        FOLLOWUP: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        ACTIVITY: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        COURSE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        CUSTOMER: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        DEAL: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        APPROVAL: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        REVENUE_REPORT: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        SALES_PERFORMANCE: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        LEAD_SOURCE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD_STATUS: { canView: true, canCreate: false, canEdit: false, canDelete: false, canArchive: false },
        QUALIFICATION: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        OPPORTUNITY: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    },
}

// ══════════════════════════════════════
// INITIALIZE SYSTEM
// ══════════════════════════════════════
export const initializeSystem = async () => {
    const t0 = Date.now()
    try {

        // ── STEP 1: ENSURE ROLES + PERMISSIONS (FAST SYNC) ─────
        // Keys on name + companyId=null (system roles are globally unique by name with null companyId).
        const existingRoles = await prisma.role.findMany({
            where: { companyId: null },
            select: { id: true, name: true, description: true, rank: true, isSystem: true, status: true }
        })
        const roleByName = new Map(existingRoles.map(r => [r.name, r]))

        const rolesToCreate = ROLES.filter(r => !roleByName.has(r.name))
        if (rolesToCreate.length) {
            await prisma.role.createMany({ data: rolesToCreate })
        }

        const rolesToUpdate = ROLES
            .map(r => {
                const existing = roleByName.get(r.name)
                if (!existing) return null
                const descChanged = (existing.description || "") !== (r.description || "")
                const rankChanged = existing.rank !== r.rank
                const statusChanged = existing.status !== r.status
                if (!descChanged && !rankChanged && !statusChanged) return null
                return { id: existing.id, description: r.description, rank: r.rank, status: r.status }
            })
            .filter(Boolean)
        if (rolesToUpdate.length > 0) {
            await Promise.all(
                rolesToUpdate.map(r => prisma.role.update({ where: { id: r.id }, data: { description: r.description, rank: r.rank, status: r.status } }))
            )
        }

        // Refresh roles after any creates/updates (we need role ids)
        const roles = await prisma.role.findMany({
            where: { companyId: null },
            select: { id: true, name: true }
        })
        const roleIdByName = new Map(roles.map(r => [r.name, r.id]))

        // Fetch existing permissions once, including all fields, then only write actual diffs
        const existingPerms = await prisma.permission.findMany({
            where: { roleId: { in: roles.map(r => r.id) } },
            select: {
                id: true,
                roleId: true,
                module: true,
                canView: true,
                canCreate: true,
                canEdit: true,
                canDelete: true,
                canArchive: true,
                canExport: true,
                canAssign: true,
                canApprove: true
            }
        })
        const permKey = (roleId, module) => `${roleId}:${module}`
        const permByKey = new Map(existingPerms.map(p => [permKey(p.roleId, p.module), p]))

        const permsToCreate = []
        const permsToUpdate = []

        for (const [roleName, modules] of Object.entries(ROLE_PERMISSIONS)) {
            const roleId = roleIdByName.get(roleName)
            if (!roleId) continue

            for (const [moduleName, perms] of Object.entries(modules)) {
                const key = permKey(roleId, moduleName)
                const existing = permByKey.get(key)

                const targetCanView = perms.canView ?? false
                const targetCanCreate = perms.canCreate ?? false
                const targetCanEdit = perms.canEdit ?? false
                const targetCanDelete = perms.canDelete ?? false
                const targetCanArchive = perms.canArchive ?? false
                const targetCanExport = perms.canExport ?? false
                const targetCanAssign = perms.canAssign ?? false
                const targetCanApprove = perms.canApprove ?? false

                if (!existing) {
                    permsToCreate.push({
                        roleId,
                        module: moduleName,
                        canView: targetCanView,
                        canCreate: targetCanCreate,
                        canEdit: targetCanEdit,
                        canDelete: targetCanDelete,
                        canArchive: targetCanArchive,
                        canExport: targetCanExport,
                        canAssign: targetCanAssign,
                        canApprove: targetCanApprove,
                    })
                    continue
                }

                const changed =
                    existing.canView !== targetCanView ||
                    existing.canCreate !== targetCanCreate ||
                    existing.canEdit !== targetCanEdit ||
                    existing.canDelete !== targetCanDelete ||
                    existing.canArchive !== targetCanArchive ||
                    existing.canExport !== targetCanExport ||
                    existing.canAssign !== targetCanAssign ||
                    existing.canApprove !== targetCanApprove

                if (changed) {
                    permsToUpdate.push({
                        id: existing.id,
                        data: {
                            canView: targetCanView,
                            canCreate: targetCanCreate,
                            canEdit: targetCanEdit,
                            canDelete: targetCanDelete,
                            canArchive: targetCanArchive,
                            canExport: targetCanExport,
                            canAssign: targetCanAssign,
                            canApprove: targetCanApprove,
                        }
                    })
                }
            }
        }

        if (permsToCreate.length) {
            await prisma.permission.createMany({ data: permsToCreate, skipDuplicates: true })
        }
        if (permsToUpdate.length) {
            await Promise.all(
                permsToUpdate.map(p => prisma.permission.update({ where: { id: p.id }, data: p.data }))
            )
        }

        // ── STEP 2: SEED DEFAULT GLOBAL LEAD SOURCES ──────────
        const defaultLeadSources = [
            "Website",
            "Walk-in",
            "Referral",
            "Social Media",
            "Google Ads",
            "Facebook Ads",
            "Telecalling",
            "Events"
        ]
        const existingLeadSources = await prisma.leadSource.findMany({
            where: { companyId: null, name: { in: defaultLeadSources } },
            select: { id: true, name: true, isActive: true }
        })
        const leadSourceByName = new Map(existingLeadSources.map(ls => [ls.name, ls]))

        const leadSourcesToCreate = defaultLeadSources
            .filter(name => !leadSourceByName.has(name))
            .map(name => ({ name, companyId: null, isActive: true }))
        if (leadSourcesToCreate.length) {
            await prisma.leadSource.createMany({ data: leadSourcesToCreate })
        }

        const leadSourcesToReactivate = existingLeadSources.filter(ls => !ls.isActive)
        if (leadSourcesToReactivate.length > 0) {
            await Promise.all(
                leadSourcesToReactivate.map(ls => prisma.leadSource.update({ where: { id: ls.id }, data: { isActive: true } }))
            )
        }

        const createdLeadSourcesCount = leadSourcesToCreate.length
        const reactivatedLeadSourcesCount = leadSourcesToReactivate.length
        if (createdLeadSourcesCount || reactivatedLeadSourcesCount) {
            console.log(
                `✅ Default lead sources synced (created: ${createdLeadSourcesCount}, reactivated: ${reactivatedLeadSourcesCount})`
            )
        } else {
            console.log("✅ Default lead sources already present")
        }

        // ── STEP 3: CREATE / VERIFY INITIAL SUPERADMIN ────────────
        const superAdminRole = await prisma.role.findFirst({
            where: { name: ROLE_NAMES.SUPER_ADMIN, companyId: null }
        })
        if (!superAdminRole) {
            throw new Error("SUPER_ADMIN role missing after system role sync in initSystem")
        }

        let superAdminUser = await prisma.user.findUnique({
            where: { email: "superadmin@gmail.com" }
        })
        if (!superAdminUser) {
            superAdminUser = await prisma.user.create({
                data: {
                    name: "Super Admin",
                    email: "superadmin@gmail.com",
                    passwordHash: await hashPassword("superadmin123"),
                    companyId: null,
                    branchId: null,
                }
            })
        }

        // ── STEP 4: ASSIGN SUPERADMIN ROLE IF MISSING ────────────
        const existingAssignment = await prisma.userRole.findFirst({
            where: {
                userId: superAdminUser.id,
                roleId: superAdminRole.id,
            }
        })

        if (!existingAssignment) {
            // Remove any duplicate roles for this user
            await prisma.userRole.deleteMany({
                where: {
                    userId: superAdminUser.id,
                    roleId: superAdminRole.id,
                }
            })

            // Then create single role entry
            await prisma.userRole.create({
                data: {
                    userId: superAdminUser.id,
                    roleId: superAdminRole.id,
                    companyId: null,
                    branchId: null,
                    isPrimary: true
                }
            })
            console.log("✅ SuperAdmin UserRole initialized/restored")
        } else {
            console.log("✅ SuperAdmin UserRole verified")
        }

        // ── STEP 4.1: SEED DEFAULT PIPELINE STAGES ───────────────
        const createdById = superAdminUser.id
        const defaultStages = [
            { name: "Prospect", stageType: "PROSPECT", colorCode: "#3b82f6", code: "PROSPECT" },
            { name: "Closure",  stageType: "CLOSURE",  colorCode: "#6366f1", code: "CLOSURE"  }
        ]
        const existingStages = await prisma.stage.findMany({
            where: {
                OR: [
                    { stageType: { in: defaultStages.map(d => d.stageType) } },
                    { name: { in: defaultStages.map(d => d.name) } }
                ]
            }
        })
        const stageByType = new Map(existingStages.map(s => [s.stageType, s]))
        const stageByName = new Map(existingStages.map(s => [s.name, s]))

        for (const def of defaultStages) {
            const existingStage = stageByType.get(def.stageType) || stageByName.get(def.name)
            if (!existingStage) {
                await prisma.stage.create({
                    data: {
                        name: def.name,
                        code: def.code,
                        stageType: def.stageType,
                        colorCode: def.colorCode,
                        isDefault: true,
                        isDeleted: false,
                        status: "ACTIVE",
                        createdById
                    }
                })
                console.log(`✅ Default stage seeded: ${def.name}`)
            } else if (existingStage.isDeleted || !existingStage.isDefault) {
                await prisma.stage.update({
                    where: { id: existingStage.id },
                    data: {
                        name: def.name,
                        stageType: def.stageType,
                        colorCode: def.colorCode,
                        isDefault: true,
                        isDeleted: false,
                        status: "ACTIVE",
                        updatedById: createdById
                    }
                })
                console.log(`✅ Default stage synced: ${def.name}`)
            }
        }

        // ── STEP 4.2: SEED DEFAULT GLOBAL LEAD STATUSES ──────────
        const defaultStatuses = [
            { name: "New", code: "NEW", displayColor: "#3b82f6", sequenceOrder: 1000, isDefault: true, isSystem: true },
            { name: "Open", code: "OPEN", displayColor: "#10b981", sequenceOrder: 2000, isDefault: false, isSystem: true },
            { name: "Duplicate", code: "DUPLICATE", displayColor: "#6b7280", sequenceOrder: 4000, isDefault: false, isSystem: true },
            { name: "Closed", code: "CLOSED", displayColor: "#ef4444", sequenceOrder: 7000, isDefault: false, isSystem: true }
        ]
        const existingGlobalStatuses = await prisma.leadStatus.findMany({
            where: { companyId: null }
        })
        const statusByCode = new Map(existingGlobalStatuses.map(s => [s.code, s]))

        const statusesToCreate = defaultStatuses
            .filter(s => !statusByCode.has(s.code))
            .map(s => ({ ...s, companyId: null, isActive: true }))

        if (statusesToCreate.length > 0) {
            await prisma.leadStatus.createMany({ data: statusesToCreate })
            console.log(`✅ Default lead statuses seeded (${statusesToCreate.length} created)`)
        }

        // Auto-space any unspaced global statuses in database by 1000 in correct order
        const allGlobalStatuses = await prisma.leadStatus.findMany({
            where: { companyId: null },
            orderBy: { sequenceOrder: 'asc' }
        })
        const unspacedStatuses = allGlobalStatuses.filter((s, idx) => s.sequenceOrder !== (idx + 1) * 1000)
        if (unspacedStatuses.length > 0) {
            await Promise.all(
                allGlobalStatuses.map((s, idx) =>
                    prisma.leadStatus.update({
                        where: { id: s.id },
                        data: { sequenceOrder: (idx + 1) * 1000 }
                    })
                )
            )
        }

        // ── STEP 5: SEED DEFAULT COMPANY HIERARCHY ──────────────
        // Only seed if no companies exist yet
        const companyCount = await prisma.company.count();
        if (companyCount === 0) {
            console.log("No companies found. Seeding default StackDot company and hierarchy...");

            // 1. Create Default Company
            const stackdotCompany = await prisma.company.create({
                data: {
                    name: "StackDot",
                    code: "STACKDOT",
                    status: "ACTIVE"
                }
            });

            // 2. Create Default Branch
            const mainBranch = await prisma.branch.create({
                data: {
                    companyId: stackdotCompany.id,
                    name: "Headquarters",
                    code: "HQ-01",
                    address: "Main Office",
                    location: "Rajkot, Gujarat",
                    status: "ACTIVE"
                }
            });

            // Retrieve System Roles for assigning reporting authority based on rank
            const companyAdminRole = await prisma.role.findFirst({ where: { name: ROLE_NAMES.COMPANY_ADMIN, companyId: null } });
            const branchManagerRole = await prisma.role.findFirst({ where: { name: ROLE_NAMES.BRANCH_MANAGER, companyId: null } });
            const bdeRole = await prisma.role.findFirst({ where: { name: ROLE_NAMES.BDE, companyId: null } });
            const iseRole = await prisma.role.findFirst({ where: { name: ROLE_NAMES.ISE, companyId: null } });

            const defaultPasswordHash = await hashPassword("password123");

            // 3. Create Users in Rank Order with upsert to prevent unique constraint conflicts
            // Tier 1: Company Admin (Rank 80)
            const defaultAdmin = await prisma.user.upsert({
                where: { email: "admin@stackdot.in" },
                update: {},
                create: {
                    name: "Dinesh Baraiya",
                    firstName: "Dinesh",
                    lastName: "Baraiya",
                    email: "admin@stackdot.in",
                    employeeId: "EMP-00001",
                    passwordHash: defaultPasswordHash,
                    status: "ACTIVE",
                    companyId: stackdotCompany.id,
                    branchId: mainBranch.id,
                    reportingManagerId: null
                }
            });
            await prisma.userRole.create({
                data: { userId: defaultAdmin.id, roleId: companyAdminRole.id, companyId: stackdotCompany.id, isPrimary: true }
            });

            // Tier 2: Branch Manager (Rank 60) - Reports to Company Admin
            const defaultManager = await prisma.user.upsert({
                where: { email: "manager@stackdot.in" },
                update: {},
                create: {
                    name: "Jeet Jagani",
                    firstName: "Jeet",
                    lastName: "Jagani",
                    email: "manager@stackdot.in",
                    employeeId: "EMP-00002",
                    passwordHash: defaultPasswordHash,
                    status: "ACTIVE",
                    companyId: stackdotCompany.id,
                    branchId: mainBranch.id,
                    reportingManagerId: defaultAdmin.id
                }
            });
            await prisma.userRole.create({
                data: { userId: defaultManager.id, roleId: branchManagerRole.id, companyId: stackdotCompany.id, branchId: mainBranch.id, isPrimary: true, assignedBy: defaultAdmin.id }
            });

            // Tier 3: BDE (Rank 40) - Reports to Branch Manager
            const defaultBDE = await prisma.user.upsert({
                where: { email: "bde@stackdot.in" },
                update: {},
                create: {
                    name: "Vivek Godhani",
                    firstName: "Vivek",
                    lastName: "Godhani",
                    email: "bde@stackdot.in",
                    employeeId: "EMP-00003",
                    passwordHash: defaultPasswordHash,
                    status: "ACTIVE",
                    companyId: stackdotCompany.id,
                    branchId: mainBranch.id,
                    reportingManagerId: defaultManager.id
                }
            });
            await prisma.userRole.create({
                data: { userId: defaultBDE.id, roleId: bdeRole.id, companyId: stackdotCompany.id, branchId: mainBranch.id, isPrimary: true, assignedBy: defaultManager.id }
            });

            // Tier 4: ISE (Rank 20) - Reports to BDE
            const defaultISE = await prisma.user.upsert({
                where: { email: "ise@stackdot.in" },
                update: {},
                create: {
                    name: "Pratik Vaghela",
                    firstName: "Pratik",
                    lastName: "Vaghela",
                    email: "ise@stackdot.in",
                    employeeId: "EMP-00004",
                    passwordHash: defaultPasswordHash,
                    status: "ACTIVE",
                    companyId: stackdotCompany.id,
                    branchId: mainBranch.id,
                    reportingManagerId: defaultBDE.id
                }
            });
            await prisma.userRole.create({
                data: { userId: defaultISE.id, roleId: iseRole.id, companyId: stackdotCompany.id, branchId: mainBranch.id, isPrimary: true, assignedBy: defaultBDE.id }
            });

            console.log("✅ Default StackDot Hierarchy Seeded Successfully!");
        }

        // ── STEP 6: BATCH SEED QUALIFICATION CRITERIA & ROLES FOR ALL COMPANIES ──
        const allCompanies = await prisma.company.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true }
        })

        if (allCompanies.length > 0) {
            const companyIds = allCompanies.map(c => c.id)
            const systemRoleNames = [
                ROLE_NAMES.COMPANY_ADMIN,
                ROLE_NAMES.BRANCH_MANAGER,
                ROLE_NAMES.BDE,
                ROLE_NAMES.ISE,
            ]
            // Pre-fetch master template roles and all company-scoped roles in bulk
            const [cachedMasterRoles, allCompanyRoles] = await Promise.all([
                prisma.role.findMany({
                    where: { companyId: null, name: { in: systemRoleNames } },
                    include: { rolePermissions: true }
                }),
                prisma.role.findMany({
                    where: { companyId: { in: companyIds }, name: { in: systemRoleNames } },
                    include: { rolePermissions: true }
                })
            ])

            const companyRolesByCompanyId = new Map()
            for (const r of allCompanyRoles) {
                if (!companyRolesByCompanyId.has(r.companyId)) {
                    companyRolesByCompanyId.set(r.companyId, [])
                }
                companyRolesByCompanyId.get(r.companyId).push(r)
            }

            // Run role verification and bulk qualification criteria verification
            await Promise.all([
                batchEnsureCompaniesCriteriaSeeded(companyIds),
                Promise.all(
                    allCompanies.map((company) =>
                        seedCompanySystemRoles(company.id, prisma, cachedMasterRoles, companyRolesByCompanyId.get(company.id) || [])
                    )
                )
            ])
            console.log(`✅ Qualification criteria & company roles verified for ${allCompanies.length} companies`)

            // ── STEP 7: BATCH SEED NOTIFICATION EVENT CONFIGS (1 BULK QUERY) ──
            const defaultEvents = [
                { eventType: "LEAD_ASSIGNED", moduleName: "LEAD" },
                { eventType: "LEAD_REASSIGNED", moduleName: "LEAD" },
                { eventType: "LEAD_STATUS_CHANGED", moduleName: "LEAD" },
                { eventType: "FOLLOWUP_REMINDER", moduleName: "FOLLOWUP" },
                { eventType: "FOLLOWUP_MISSED", moduleName: "FOLLOWUP" },
                { eventType: "FOLLOWUP_COMPLETED", moduleName: "FOLLOWUP" },
                { eventType: "OPPORTUNITY_CREATED", moduleName: "OPPORTUNITY" },
                { eventType: "OPPORTUNITY_STAGE_CHANGED", moduleName: "OPPORTUNITY" },
                { eventType: "OPPORTUNITY_WON", moduleName: "OPPORTUNITY" },
                { eventType: "OPPORTUNITY_LOST", moduleName: "OPPORTUNITY" },
                { eventType: "TARGET_ACHIEVED", moduleName: "KPI" },
                { eventType: "REVENUE_MILESTONE", moduleName: "REVENUE" },
                { eventType: "KPI_BELOW_TARGET", moduleName: "KPI" },
                { eventType: "USER_CREATED", moduleName: "SYSTEM" },
                { eventType: "PASSWORD_CHANGED", moduleName: "SYSTEM" },
                { eventType: "MAINTENANCE_ANNOUNCEMENT", moduleName: "SYSTEM" },
                { eventType: "BACKUP_COMPLETED", moduleName: "SYSTEM" },
            ]

            const existingConfigs = await prisma.notificationEventConfig.findMany({
                where: { companyId: { in: companyIds } },
                select: { companyId: true, eventType: true }
            })
            const existingConfigSet = new Set(existingConfigs.map(c => `${c.companyId}_${c.eventType}`))

            const missingConfigs = []
            for (const company of allCompanies) {
                for (const evt of defaultEvents) {
                    if (!existingConfigSet.has(`${company.id}_${evt.eventType}`)) {
                        missingConfigs.push({
                            companyId: company.id,
                            eventType: evt.eventType,
                            moduleName: evt.moduleName,
                            isEnabled: true,
                            channels: { inApp: true, email: true, push: false },
                        })
                    }
                }
            }

            if (missingConfigs.length > 0) {
                await prisma.notificationEventConfig.createMany({
                    data: missingConfigs,
                    skipDuplicates: true
                })
                console.log(`✅ Seeded ${missingConfigs.length} missing notification configs`)
            }
        }

        console.log(`✅ System initialized in ${Date.now() - t0}ms`)

    } catch (error) {
        console.error("System initialization failed:", error)
        throw error
    }
}

/**
 * Ensures company-scoped system roles (COMPANY_ADMIN, BRANCH_MANAGER, BDE, ISE) and their permissions exist for a company.
 * Clones from global master templates (companyId: null) if not present.
 * Also remaps any userRole pointing to global master roles to point to company-scoped roles instead.
 */
export const seedCompanySystemRoles = async (companyId, tx = prisma, cachedMasterRoles = null, cachedCompanyRoles = null) => {
    const systemRoleNames = [
        ROLE_NAMES.COMPANY_ADMIN,
        ROLE_NAMES.BRANCH_MANAGER,
        ROLE_NAMES.BDE,
        ROLE_NAMES.ISE,
    ]

    // Fetch master template roles (companyId: null) with permissions if not passed in
    const masterRoles = cachedMasterRoles || await tx.role.findMany({
        where: { companyId: null, name: { in: systemRoleNames } },
        include: { rolePermissions: true }
    })
    const masterRoleByName = new Map(masterRoles.map(r => [r.name, r]))

    // Fetch existing company-scoped roles if not passed in
    const existingCompanyRoles = cachedCompanyRoles || await tx.role.findMany({
        where: { companyId, name: { in: systemRoleNames } },
        include: { rolePermissions: true }
    })
    const companyRoleByName = new Map(existingCompanyRoles.map(r => [r.name, r]))

    for (const roleName of systemRoleNames) {
        const masterRole = masterRoleByName.get(roleName)
        if (!masterRole) continue

        let companyRole = companyRoleByName.get(roleName)

        // If company-scoped role doesn't exist, create it and clone permissions
        if (!companyRole) {
            companyRole = await tx.role.create({
                data: {
                    name: masterRole.name,
                    description: masterRole.description,
                    rank: masterRole.rank,
                    isSystem: true, // Display as SYSTEM role in UI
                    status: "ACTIVE",
                    companyId: companyId
                },
                include: { rolePermissions: true }
            })

            // Clone permissions from master template
            const permsToCreate = masterRole.rolePermissions.map(p => ({
                roleId: companyRole.id,
                module: p.module,
                canView: p.canView,
                canCreate: p.canCreate,
                canEdit: p.canEdit,
                canDelete: p.canDelete,
                canArchive: p.canArchive,
                canExport: p.canExport ?? false,
                canAssign: p.canAssign ?? false,
                canApprove: p.canApprove ?? false,
            }))

            if (permsToCreate.length > 0) {
                await tx.permission.createMany({
                    data: permsToCreate,
                    skipDuplicates: true
                })
            }
        } else if (!companyRole.isSystem) {
            // Ensure existing cloned core roles are marked as isSystem: true for UI consistency
            await tx.role.update({
                where: { id: companyRole.id },
                data: { isSystem: true }
            })
        }
    }
}