// src/config/initSystem.js

import prisma from "./db.js"
import { hashPassword } from "../utils/passwordUtils.js"
import {
  ROLE_NAMES,
  ROLE_RANKS,
  MODULES,
} from "./roleConstants.js"

// ══════════════════════════════════════
// SYSTEM ROLES — seeds on every startup
// name  = role identifier (unique within companyId=null scope)
// rank  = authority level (100=highest) — gapped so custom roles can slot in
// isSystem = true locks rank & name, prevents deletion
// ══════════════════════════════════════
const ROLES = [
  { name: ROLE_NAMES.SUPER_ADMIN,    rank: ROLE_RANKS.SUPER_ADMIN,    isSystem: true, status: "ACTIVE", description: "Super Admin - Full system access" },
  { name: ROLE_NAMES.COMPANY_ADMIN,  rank: ROLE_RANKS.COMPANY_ADMIN,  isSystem: true, status: "ACTIVE", description: "Company Admin - Company wide full access" },
  { name: ROLE_NAMES.BRANCH_MANAGER, rank: ROLE_RANKS.BRANCH_MANAGER, isSystem: true, status: "ACTIVE", description: "Branch Manager - Full branch access and approvals" },
  { name: ROLE_NAMES.BDE,            rank: ROLE_RANKS.BDE,            isSystem: true, status: "ACTIVE", description: "Business Development Executive - Client acquisition and follow-ups" },
  { name: ROLE_NAMES.ISE,            rank: ROLE_RANKS.ISE,            isSystem: true, status: "ACTIVE", description: "Inside Sales Executive - Support and lead nurture" },
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
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        ACTIVITY: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        COURSE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        TARGET: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        CUSTOMER: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        APPROVAL: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        AUDIT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    },

    COMPANY_ADMIN: {
        SYSTEM_SETTINGS: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        COMPANY: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        BRANCH: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        ROLE_PERMISSION: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        USER: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        TEAM: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD_ASSIGNMENT: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        TASK: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        ACTIVITY: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        COURSE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        TARGET: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        CUSTOMER: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        APPROVAL: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    },

    BRANCH_MANAGER: {
        SYSTEM_SETTINGS: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        COMPANY: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        BRANCH: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        ROLE_PERMISSION: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        USER: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        TEAM: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD_ASSIGNMENT: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        TASK: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        ACTIVITY: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        COURSE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        CUSTOMER: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        APPROVAL: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    },

    BDE: {
        SYSTEM_SETTINGS: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        COMPANY: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        BRANCH: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        ROLE_PERMISSION: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        USER: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TEAM: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        LEAD_ASSIGNMENT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        PIPELINE: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        ACTIVITY: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        COURSE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        CUSTOMER: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        APPROVAL: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
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
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        ACTIVITY: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        COURSE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        CUSTOMER: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        APPROVAL: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    },
}

// ══════════════════════════════════════
// INITIALIZE SYSTEM
// ══════════════════════════════════════
export const initializeSystem = async () => {
    try {

        // Check if SuperAdmin already exists
        const existingSuperAdmin = await prisma.user.findUnique({
            where: { email: "superadmin@gmail.com" }
        })

        // ── STEP 0: ENSURE ROLES + PERMISSIONS (FAST SYNC) ─────
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
                const descChanged   = (existing.description || "") !== (r.description || "")
                const rankChanged   = existing.rank !== r.rank
                const statusChanged = existing.status !== r.status
                if (!descChanged && !rankChanged && !statusChanged) return null
                return { id: existing.id, description: r.description, rank: r.rank, status: r.status }
            })
            .filter(Boolean)
        for (const r of rolesToUpdate) {
            await prisma.role.update({ where: { id: r.id }, data: { description: r.description, rank: r.rank, status: r.status } })
        }

        // Refresh roles after any creates/updates (we need role ids)
        const roles = await prisma.role.findMany({
            where: { companyId: null },
            select: { id: true, name: true }
        })
        const roleIdByName = new Map(roles.map(r => [r.name, r.id]))

        // Fetch existing permissions once, then only write diffs
        const existingPerms = await prisma.permission.findMany({
            where: { roleId: { in: roles.map(r => r.id) } },
            select: { id: true, roleId: true, module: true, canView: true, canCreate: true, canEdit: true, canDelete: true }
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

                if (!existing) {
                    permsToCreate.push({
                        roleId,
                        module: moduleName,
                        canView: perms.canView,
                        canCreate: perms.canCreate,
                        canEdit: perms.canEdit,
                        canDelete: perms.canDelete,
                    })
                    continue
                }

                const changed =
                    existing.canView !== perms.canView ||
                    existing.canCreate !== perms.canCreate ||
                    existing.canEdit !== perms.canEdit ||
                    existing.canDelete !== perms.canDelete

                if (changed) {
                    permsToUpdate.push({
                        id: existing.id,
                        data: {
                            canView: perms.canView,
                            canCreate: perms.canCreate,
                            canEdit: perms.canEdit,
                            canDelete: perms.canDelete,
                        }
                    })
                }
            }
        }

        if (permsToCreate.length) {
            await prisma.permission.createMany({ data: permsToCreate })
        }
        for (const p of permsToUpdate) {
            await prisma.permission.update({ where: { id: p.id }, data: p.data })
        }

        // ── STEP 4: SEED DEFAULT GLOBAL LEAD SOURCES ──────────
        const defaultLeadSources = [
            "Cold Call",
            "Referral",
            "Website",
            "Social Media",
            "Walk In",
            "Exhibition",
            "Other"
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
        for (const ls of leadSourcesToReactivate) {
            await prisma.leadSource.update({ where: { id: ls.id }, data: { isActive: true } })
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

        if (!existingSuperAdmin) {
            console.log("First time — initializing system...")

            // ── STEP 3: CREATE INITIAL SUPERADMIN ──────────────
            // Uses findFirst with name + companyId:null (system roles are unique within null company scope)
            const superAdminRole = await prisma.role.findFirst({
                where: { name: ROLE_NAMES.SUPER_ADMIN, companyId: null }
            })

            const superAdminUser = await prisma.user.upsert({
                where: { email: "superadmin@gmail.com" },
                update: { passwordHash: await hashPassword("superadmin123") },
                create: {
                    name: "Super Admin",
                    email: "superadmin@gmail.com",
                    passwordHash: await hashPassword("superadmin123"),
                    companyId: null,
                    branchId: null,
                }
            })

            // ── STEP 4: ASSIGN ROLE (FIXED — NO UPSERT WITH NULL) ─
            // First, remove any duplicate roles for this user
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

            console.log("SuperAdmin ensured")
            console.log("System initialized successfully!")
        } else {
            console.log("System already initialized — SuperAdmin exists, syncing defaults")
        }

        const createdById = (await prisma.user.findUnique({ where: { email: "superadmin@gmail.com" }, select: { id: true } }))?.id
        if (createdById) {
            const defaultStages = ["Prospect", "Closure"]
            for (const stageName of defaultStages) {
                const existingStage = await prisma.stage.findUnique({
                    where: { name: stageName },
                    select: { id: true, isDeleted: true, isDefault: true, name: true }
                })
                if (!existingStage) {
                    await prisma.stage.create({
                        data: {
                            name: stageName,
                            isDefault: true,
                            isDeleted: false,
                            createdById
                        }
                    })
                    console.log(`✅ Default stage seeded: ${stageName}`)
                } else if (existingStage.isDeleted || !existingStage.isDefault) {
                    await prisma.stage.update({
                        where: { id: existingStage.id },
                        data: {
                            name: stageName,
                            isDefault: true,
                            isDeleted: false,
                            updatedById: createdById
                        }
                    })
                    console.log(`✅ Default stage synced: ${stageName}`)
                }
            }
        }


        // Add this at the end of initializeSystem() in src/config/initSystem.js



    } catch (error) {
        console.error("System initialization failed:", error)
        throw error
    }
}