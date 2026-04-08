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
        PIPELINE: { canView: false, canCreate: false, canEdit: false, canDelete: false },
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

        if (existingSuperAdmin) {
            console.log("ℹ️  System already initialized — SuperAdmin exists, skipping initialization")
            return
        }

        console.log("🔄 First time — initializing system...")

        // ── STEP 1: CREATE ROLES ──────────────────────────────
        for (const role of ROLES) {
            await prisma.role.upsert({
                where: { name: role.name },
                update: {},
                create: role
            })
        }
        console.log("✅ Roles created")

        // ── STEP 2: CREATE PERMISSIONS PER ROLE ──────────────
        for (const [roleName, modules] of Object.entries(ROLE_PERMISSIONS)) {

            const role = await prisma.role.findUnique({
                where: { name: roleName }
            })

            for (const [moduleName, perms] of Object.entries(modules)) {
                await prisma.permission.upsert({
                    where: {
                        roleId_module: {
                            roleId: role.id,
                            module: moduleName
                        }
                    },
                    update: perms,
                    create: {
                        roleId: role.id,
                        module: moduleName,
                        canView: perms.canView,
                        canCreate: perms.canCreate,
                        canEdit: perms.canEdit,
                        canDelete: perms.canDelete,
                    }
                })
            }
        }
        console.log("✅ Permissions seeded")

        // ── STEP 3: CREATE INITIAL SUPERADMIN ──────────────
        const superAdminRole = await prisma.role.findUnique({
            where: { name: "SUPER_ADMIN" }
        })

        const superAdminUser = await prisma.user.upsert({
            where: { email: "superadmin@gmail.com" },
            update: {  passwordHash: await hashPassword("superadmin123") },
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

        console.log("✅ SuperAdmin ensured")
        console.log("🎉 System initialized successfully!")

    } catch (error) {
        console.error("❌ System initialization failed:", error)
        throw error
    }
}