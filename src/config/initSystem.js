// src/config/initSystem.js

import prisma from "./db.js"
import { hashPassword } from "../utils/passwordUtils.js"

// ══════════════════════════════════════
// ROLES
// ══════════════════════════════════════
const ROLES = [
    { name: "SUPER_ADMIN", description: "Full system access" },
    { name: "CEO", description: "Company wide read only" },
    { name: "BRANCH_ADMIN", description: "Full branch access" },
    { name: "MANAGER", description: "Team view and approvals" },
    { name: "ISE", description: "Own prospects only" },
    { name: "SALES_TEAM", description: "Sales team access with ISE permissions" },
]

// ══════════════════════════════════════
// MODULES
// ══════════════════════════════════════
const MODULES = [
    "COMPANY",
    "BRANCH",
    "USER",
    "PROSPECT",
    "ACTIVITY",
    "TASK",
    "PIPELINE",
    "STAGE",
    "LEAD",
    "SESSION",
    "REPORT",
    "AUDIT",
    "TARGET",
    "NOTIFICATION",
]

// ══════════════════════════════════════
// PERMISSION MATRIX PER ROLE
// Format: { canView, canCreate, canEdit, canDelete }
// ══════════════════════════════════════
const ROLE_PERMISSIONS = {

    SUPER_ADMIN: {
        COMPANY: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        BRANCH: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        USER: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        PROSPECT: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        ACTIVITY: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        STAGE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        SESSION: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        REPORT: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        AUDIT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        NOTIFICATION: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    },

    CEO: {
        COMPANY: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        BRANCH: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        USER: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        PROSPECT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        ACTIVITY: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        TASK: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        PIPELINE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        STAGE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        SESSION: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
    },

    BRANCH_ADMIN: {
        COMPANY: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        BRANCH: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        USER: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        PROSPECT: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        ACTIVITY: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        PIPELINE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        STAGE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        SESSION: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
    },

    MANAGER: {
        COMPANY: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        BRANCH: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        USER: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        PROSPECT: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        ACTIVITY: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        PIPELINE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        STAGE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        SESSION: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
    },

    ISE: {
        COMPANY: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        BRANCH: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        USER: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        PROSPECT: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        ACTIVITY: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        PIPELINE: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        STAGE: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        LEAD: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        SESSION: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        REPORT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
    },

    SALES_TEAM: {
        COMPANY: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        BRANCH: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        USER: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        PROSPECT: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        ACTIVITY: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        TASK: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        PIPELINE: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        STAGE: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        LEAD: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        SESSION: { canView: true, canCreate: true, canEdit: false, canDelete: false },
        REPORT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        TARGET: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
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
        // Goal: don't write on every restart — only create/update if missing or changed.
        const existingRoles = await prisma.role.findMany({ select: { id: true, name: true, description: true } })
        const roleByName = new Map(existingRoles.map(r => [r.name, r]))

        const rolesToCreate = ROLES.filter(r => !roleByName.has(r.name))
        if (rolesToCreate.length) {
            await prisma.role.createMany({ data: rolesToCreate })
        }

        const rolesToUpdate = ROLES
            .map(r => {
                const existing = roleByName.get(r.name)
                if (!existing) return null
                if ((existing.description || "") === (r.description || "")) return null
                return { id: existing.id, description: r.description }
            })
            .filter(Boolean)
        for (const r of rolesToUpdate) {
            await prisma.role.update({ where: { id: r.id }, data: { description: r.description } })
        }

        // Refresh roles after any creates/updats (we need role ids)
        const roles = await prisma.role.findMany({ select: { id: true, name: true } })
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
            const superAdminRole = await prisma.role.findUnique({
                where: { name: "SUPER_ADMIN" }
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