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
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        AUDIT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD_SOURCE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        LEAD_STATUS: { canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: false },
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
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD_SOURCE: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        LEAD_STATUS: { canView: true, canCreate: true, canEdit: true, canDelete: false, canArchive: false },
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
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD_SOURCE: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        LEAD_STATUS: { canView: true, canCreate: false, canEdit: false, canDelete: false, canArchive: false },
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
        REPORT: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        LEAD_SOURCE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD_STATUS: { canView: true, canCreate: false, canEdit: false, canDelete: false, canArchive: false },
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
        REPORT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        NOTIFICATION: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        AUDIT: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        LEAD_SOURCE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        LEAD_STATUS: { canView: true, canCreate: false, canEdit: false, canDelete: false, canArchive: false },
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
                const descChanged = (existing.description || "") !== (r.description || "")
                const rankChanged = existing.rank !== r.rank
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
                        canView: perms.canView ?? false,
                        canCreate: perms.canCreate ?? false,
                        canEdit: perms.canEdit ?? false,
                        canDelete: perms.canDelete ?? false,
                        canArchive: perms.canArchive ?? false,
                    })
                    continue
                }

                const changed =
                    existing.canView !== (perms.canView ?? false) ||
                    existing.canCreate !== (perms.canCreate ?? false) ||
                    existing.canEdit !== (perms.canEdit ?? false) ||
                    existing.canDelete !== (perms.canDelete ?? false) ||
                    existing.canArchive !== (perms.canArchive ?? false)

                if (changed) {
                    permsToUpdate.push({
                        id: existing.id,
                        data: {
                            canView: perms.canView ?? false,
                            canCreate: perms.canCreate ?? false,
                            canEdit: perms.canEdit ?? false,
                            canDelete: perms.canDelete ?? false,
                            canArchive: perms.canArchive ?? false,
                        }
                    })
                }
            }
        }

        if (permsToCreate.length) {
            await prisma.permission.createMany({ data: permsToCreate, skipDuplicates: true })
        }
        for (const p of permsToUpdate) {
            await prisma.permission.update({ where: { id: p.id }, data: p.data })
        }

        // ── STEP 4: SEED DEFAULT GLOBAL LEAD SOURCES ──────────
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

        // ── STEP 3: CREATE/UPDATE INITIAL SUPERADMIN ──────────────
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

        // ── STEP 4: ASSIGN ROLE IF MISSING ─
        const existingAssignment = await prisma.userRole.findFirst({
            where: {
                userId: superAdminUser.id,
                roleId: superAdminRole.id,
            }
        })

        if (!existingAssignment) {
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
            console.log("✅ SuperAdmin UserRole initialized/restored")
        } else {
            console.log("✅ SuperAdmin UserRole verified")
        }

        console.log("System initialized successfully!")

        const createdById = (await prisma.user.findUnique({ where: { email: "superadmin@gmail.com" }, select: { id: true } }))?.id
        if (createdById) {
            const defaultStages = [
                { name: "Prospect", stageType: "PROSPECT", colorCode: "#3b82f6", code: "PROSPECT" },
                { name: "Closure",  stageType: "CLOSURE",  colorCode: "#6366f1", code: "CLOSURE"  }
            ]
            for (const def of defaultStages) {
                const existingStage = await prisma.stage.findFirst({
                    where: { stageType: def.stageType },
                    select: { id: true, isDeleted: true, isDefault: true, name: true }
                }) || await prisma.stage.findUnique({
                    where: { name: def.name },
                    select: { id: true, isDeleted: true, isDefault: true, name: true }
                })
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
        }

        // ── STEP 4.2: SEED DEFAULT GLOBAL LEAD STATUSES ──
        const defaultStatuses = [
            { name: "New", code: "NEW", displayColor: "#3b82f6", sequenceOrder: 1000, isDefault: true, isSystem: true },
            { name: "Open", code: "OPEN", displayColor: "#10b981", sequenceOrder: 2000, isDefault: false, isSystem: true },
            { name: "Duplicate", code: "DUPLICATE", displayColor: "#6b7280", sequenceOrder: 4000, isDefault: false, isSystem: true },
            { name: "Closed", code: "CLOSED", displayColor: "#ef4444", sequenceOrder: 7000, isDefault: false, isSystem: true }
        ]
        for (const status of defaultStatuses) {
            const existingStatus = await prisma.leadStatus.findFirst({
                where: { companyId: null, code: status.code }
            })
            if (!existingStatus) {
                await prisma.leadStatus.create({
                    data: {
                        ...status,
                        companyId: null,
                        isActive: true
                    }
                })
                console.log(`✅ Default lead status seeded: ${status.name}`)
            }
        }

        // Auto-space all global statuses in database by 1000 on startup
        const globalStatuses = await prisma.leadStatus.findMany({
            where: { companyId: null },
            orderBy: { sequenceOrder: 'asc' }
        })
        for (let idx = 0; idx < globalStatuses.length; idx++) {
            const targetSeq = (idx + 1) * 1000
            if (globalStatuses[idx].sequenceOrder !== targetSeq) {
                await prisma.leadStatus.update({
                    where: { id: globalStatuses[idx].id },
                    data: { sequenceOrder: targetSeq }
                })
                console.log(`🔄 Spaced out global status: ${globalStatuses[idx].name} to ${targetSeq}`)
            }
        }



        // ── STEP 5: SEED DEFAULT COMPANY HIERARCHY ──────────
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

            // 3. Create Users in Rank Order (establishing reportingManagerId hierarchy)

            // Tier 1: Company Admin (Rank 80)
            const defaultAdmin = await prisma.user.create({
                data: {
                    name: "Dinesh Baraiya",
                    firstName: "Dinesh",
                    lastName: "Baraiya",
                    email: "admin@stackdot.in",
                    employeeId: "EMP-00001",
                    passwordHash: defaultPasswordHash,
                    status: "ACTIVE",
                    companyId: stackdotCompany.id,
                    branchId: mainBranch.id, // Usually company admins might not have branch, but for org chart let's assign
                    reportingManagerId: null // Top of hierarchy
                }
            });
            await prisma.userRole.create({
                data: { userId: defaultAdmin.id, roleId: companyAdminRole.id, companyId: stackdotCompany.id, isPrimary: true }
            });

            // Tier 2: Branch Manager (Rank 60) - Reports to Company Admin
            const defaultManager = await prisma.user.create({
                data: {
                    name: "Jeet Jagani",
                    firstName: "Jeet",
                    lastName: "Jagani",
                    email: "manager@stackdot.in",
                    employeeId: "EMP-00002",
                    passwordHash: defaultPasswordHash,
                    status: "ACTIVE",
                    companyId: stackdotCompany.id,
                    branchId: mainBranch.id,
                    reportingManagerId: defaultAdmin.id // Rank 60 reports to Rank 80
                }
            });
            await prisma.userRole.create({
                data: { userId: defaultManager.id, roleId: branchManagerRole.id, companyId: stackdotCompany.id, branchId: mainBranch.id, isPrimary: true, assignedBy: defaultAdmin.id }
            });

            // Tier 3: BDE (Rank 40) - Reports to Branch Manager
            const defaultBDE = await prisma.user.create({
                data: {
                    name: "Vivek Godhani",
                    firstName: "Vivek",
                    lastName: "Godhani",
                    email: "bde@stackdot.in",
                    employeeId: "EMP-00003",
                    passwordHash: defaultPasswordHash,
                    status: "ACTIVE",
                    companyId: stackdotCompany.id,
                    branchId: mainBranch.id,
                    reportingManagerId: defaultManager.id // Rank 40 reports to Rank 60
                }
            });
            await prisma.userRole.create({
                data: { userId: defaultBDE.id, roleId: bdeRole.id, companyId: stackdotCompany.id, branchId: mainBranch.id, isPrimary: true, assignedBy: defaultManager.id }
            });

            // Tier 4: ISE (Rank 20) - Reports to BDE
            const defaultISE = await prisma.user.create({
                data: {
                    name: "Pratik Vaghela",
                    firstName: "Pratik",
                    lastName: "Vaghela",
                    email: "ise@stackdot.in",
                    employeeId: "EMP-00004",
                    passwordHash: defaultPasswordHash,
                    status: "ACTIVE",
                    companyId: stackdotCompany.id,
                    branchId: mainBranch.id,
                    reportingManagerId: defaultBDE.id // Rank 20 reports to Rank 40
                }
            });
            await prisma.userRole.create({
                data: { userId: defaultISE.id, roleId: iseRole.id, companyId: stackdotCompany.id, branchId: mainBranch.id, isPrimary: true, assignedBy: defaultBDE.id }
            });

            console.log("✅ Default StackDot Hierarchy Seeded Successfully!");
        }
    } catch (error) {
        console.error("System initialization failed:", error)
        throw error
    }
}