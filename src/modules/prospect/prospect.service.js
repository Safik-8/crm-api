// src/modules/prospect/prospect.service.js

import prisma from "../../config/db.js"
import { generateProspectCode } from "./prospectCode.js"
import { STAGES, canTransition, isValidStage } from "./stageMachine.js"
import {
    ValidationError,
    NotFoundError,
    ConflictError,
    ForbiddenError,
    BadRequestError
} from "../../utils/AppError.js"

// ══════════════════════════════════════════════════════════
// COMPANY ISOLATION GUARD
// ══════════════════════════════════════════════════════════

const assertCompanyScope = (actor, targetCompanyId) => {
    // SUPER_ADMIN has no companyId — can access all
    if (!actor.companyId) return

    if (actor.companyId !== targetCompanyId) {
        throw new ForbiddenError("You cannot access data from another company")
    }
}

// ══════════════════════════════════════════════════════════
// ROLE-BASED SCOPE WHERE CLAUSE
// Built from actor's companyId, branchId, id
// NOT from primaryRole string
//
// How scope is determined:
//   actor.companyId = null  → SUPER_ADMIN (no company restriction)
//   actor.companyId set
//     + actor.branchId = null  → CEO (company wide)
//     + actor.branchId set
//         + actor.permissions.PROSPECT.canDelete = true  → BRANCH_ADMIN
//         + actor.permissions.PROSPECT.canDelete = false
//             + canCreate = true  → ISE (own only)
//             + canCreate = false → view only
// ══════════════════════════════════════════════════════════

const getScopeWhere = async (actor) => {

    // No companyId → Super Admin level → no restriction
    if (!actor.companyId) return {}

    const prospectPerms = actor.permissions?.PROSPECT || {}

    // Has companyId but no branchId → CEO level → company wide
    if (!actor.branchId) {
        return { companyId: actor.companyId }
    }

    // Has both companyId and branchId
    // Check if can delete → Branch Admin level → full branch access
    if (prospectPerms.canDelete) {
        return {
            companyId: actor.companyId,
            branchId: actor.branchId
        }
    }

    // Cannot delete but can create → ISE level → own prospects only
    if (prospectPerms.canCreate) {
        return {
            companyId: actor.companyId,
            branchId: actor.branchId,
            assignedToId: actor.id
        }
    }

    // Can only view → Manager level
    // Manager sees their branch team prospects
    if (prospectPerms.canView) {
        const teamMembers = await prisma.user.findMany({
            where: {
                branchId: actor.branchId,
                companyId: actor.companyId
            },
            select: { id: true }
        })
        const teamIds = teamMembers.map(u => u.id)

        return {
            companyId: actor.companyId,
            branchId: actor.branchId,
            assignedToId: { in: teamIds }
        }
    }

    // No prospect permissions at all
    throw new ForbiddenError("You do not have access to prospects")
}

// ══════════════════════════════════════════════════════════
// BE-2-01 | CREATE PROSPECT
// ══════════════════════════════════════════════════════════

export const createProspectService = async (data, actor) => {

    const {
        name,
        mobile,
        email,
        education,
        college,
        city,
        leadSourceId,
        assignedToId,
        expectedRevenue,
        duplicate_acknowledged = false
    } = data

    // ── VALIDATE MANDATORY FIELDS ─────────────────────────
    const errors = []
    if (!name) errors.push({ field: "name", message: "Name is required" })
    if (!mobile) errors.push({ field: "mobile", message: "Mobile is required" })
    if (!leadSourceId) errors.push({ field: "leadSourceId", message: "Lead source is required" })
    if (errors.length > 0) throw new ValidationError("Validation failed", errors)

    // ── AUTO ASSIGN FROM req.user ─────────────────────────
    const companyId = actor.companyId
    const branchId = actor.branchId
    const createdById = actor.id
    const finalAssignedToId = assignedToId ? Number(assignedToId) : actor.id

    // ── VALIDATE assignedTo BELONGS TO SAME COMPANY ───────
    if (assignedToId) {
        const assignedUser = await prisma.user.findFirst({
            where: {
                id: Number(assignedToId),
                companyId: companyId
            }
        })
        if (!assignedUser) {
            throw new ForbiddenError("Assigned user does not belong to your company")
        }
    }

    // ── VALIDATE leadSource BELONGS TO COMPANY OR GLOBAL ──
    const leadSource = await prisma.leadSource.findFirst({
        where: {
            id: Number(leadSourceId),

            isActive: true,
            OR: [
                { companyId: null },
                { companyId: companyId }
            ]
        },
        select: { id: true },

    })
    console.log("leadso", leadSource);

    if (!leadSource) throw new NotFoundError("Lead source")

    // ── BE-2-03 | DUPLICATE DETECTION ─────────────────────
    // Scoped to same company — no cross-company leakage
    const duplicate = await prisma.prospect.findFirst({
        where: { mobile, companyId },
        select: { id: true, prospectCode: true, name: true }
    })

    if (duplicate && !duplicate_acknowledged) {
        throw new ConflictError(
            `Mobile already exists for prospect ${duplicate.name} (${duplicate.prospectCode})`,
            "mobile"
        )
    }

    // ── BE-2-02 | GENERATE PROSPECT CODE ──────────────────
    const prospectCode = await generateProspectCode(companyId, branchId)

    // ── CREATE PROSPECT + INITIAL STAGE HISTORY ───────────
    const created = await prisma.$transaction(async (tx) => {

        const prospect = await tx.prospect.create({
            data: {
                prospectCode,
                name,
                mobile,
                email: email || null,
                education: education || null,
                college: college || null,
                city: city || null,
                leadSourceId: Number(leadSourceId),
                currentStage: STAGES.NEW,
                expectedRevenue: expectedRevenue || null,
                duplicateAcknowledged: duplicate_acknowledged,
                assignedToId: finalAssignedToId,
                companyId,
                branchId,
                createdById
            }
        })

        await tx.stageHistory.create({
            data: {
                prospectId: prospect.id,
                oldStage: null,        // null = initial creation
                newStage: STAGES.NEW,
                changedById: createdById,
                note: "Prospect created"
            }
        })

        return prospect
    })

    return prisma.prospect.findUnique({
        where: { id: created.id },
        include: {
            company: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true, code: true } },
            leadSource: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true } }
        }
    })
}

// ══════════════════════════════════════════════════════════
// BE-2-01 | GET ALL PROSPECTS
// ══════════════════════════════════════════════════════════

export const getProspectsService = async (query, actor) => {

    const {
        stage,
        lead_source_id,
        branch_id,
        assigned_to,
        start_date,
        end_date,
        search,
        page = 1,
        limit = 10
    } = query

    // Role-based base scope — built from actor fields not role string
    const scopeWhere = await getScopeWhere(actor)
    const where = { ...scopeWhere }

    // ── FILTERS ───────────────────────────────────────────
    if (stage) where.currentStage = stage
    if (lead_source_id) where.leadSourceId = Number(lead_source_id)
    if (assigned_to) where.assignedToId = Number(assigned_to)

    // Branch filter with company isolation
    if (branch_id) {
        const requestedBranchId = Number(branch_id)

        // Actor has a branch — can only filter their own branch
        if (actor.branchId && actor.branchId !== requestedBranchId) {
            throw new ForbiddenError("You cannot access prospects from another branch")
        }

        // Actor has company but no branch (CEO level)
        // Verify requested branch belongs to same company
        if (actor.companyId && !actor.branchId) {
            const branch = await prisma.branch.findFirst({
                where: { id: requestedBranchId, companyId: actor.companyId }
            })
            if (!branch) {
                throw new ForbiddenError("Branch does not belong to your company")
            }
        }

        where.branchId = requestedBranchId
    }

    // Date range
    if (start_date || end_date) {
        where.createdAt = {}
        if (start_date) where.createdAt.gte = new Date(start_date)
        if (end_date) where.createdAt.lte = new Date(end_date)
    }

    // Search — name OR mobile
    if (search) {
        where.AND = [
            ...(where.AND || []),
            {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { mobile: { contains: search } }
                ]
            }
        ]
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [prospects, total] = await Promise.all([
        prisma.prospect.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: Number(limit),
            include: {
                company: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
                leadSource: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } }
            }
        }),
        prisma.prospect.count({ where })
    ])

    const formattedProspects = prospects.map(p => ({
        id: p.id,
        prospectCode: p.prospectCode,
        name: p.name,
        mobile: p.mobile,
        email: p.email,
        education: p.education,
        college: p.college,
        city: p.city,
        leadSourceName: p.leadSource?.name || null,
        currentStage: p.currentStage,
        tokenAmount: p.tokenAmount,
        joiningDate: p.joiningDate,
        expectedRevenue: p.expectedRevenue,
        winDate: p.winDate,
        duplicateAcknowledged: p.duplicateAcknowledged,
        archivedAt: p.archivedAt,
        archivedById: p.archivedById,
        managerApprovalId: p.managerApprovalId,
        unarchivedAt: p.unarchivedAt,
        unarchivedById: p.unarchivedById,
        assignedToName: p.assignedTo?.name || null,
        createdByName: p.createdBy?.name || null,
        companyName: p.company?.name || null,
        branchName: p.branch?.name || null,
        lastActivityAt: p.lastActivityAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
    }))

    return {
        prospects: formattedProspects,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    }
}

// ══════════════════════════════════════════════════════════
// BE-2-01 | GET PROSPECT BY ID
// ══════════════════════════════════════════════════════════

export const getProspectByIdService = async (id, actor) => {

    const scopeWhere = await getScopeWhere(actor)

    const prospect = await prisma.prospect.findFirst({
        where: { id: Number(id), ...scopeWhere },
        include: {
            company: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true, code: true } },
            leadSource: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true } },
            stageHistory: {
                orderBy: { changedAt: "asc" },
                include: {
                    changedBy: { select: { id: true, name: true } }
                }
            }
        }
    })

    if (!prospect) throw new NotFoundError("Prospect")

    // Final company isolation
    assertCompanyScope(actor, prospect.companyId)

    return prospect
}

// ══════════════════════════════════════════════════════════
// BE-2-01 | UPDATE PROSPECT
// prospectCode is IMMUTABLE — always stripped
// ══════════════════════════════════════════════════════════

export const updateProspectService = async (id, data, actor) => {

    const scopeWhere = await getScopeWhere(actor)

    const prospect = await prisma.prospect.findFirst({
        where: { id: Number(id), ...scopeWhere }
    })

    if (!prospect) throw new NotFoundError("Prospect")

    // Company isolation
    assertCompanyScope(actor, prospect.companyId)

    // ISE level (canCreate, no canDelete) — can only edit own prospects
    const prospectPerms = actor.permissions?.PROSPECT || {}
    if (prospectPerms.canCreate && !prospectPerms.canDelete) {
        if (prospect.assignedToId !== actor.id) {
            throw new ForbiddenError("You can only edit your own prospects")
        }
    }

    // Validate new leadSource — must belong to same company or global
    if (data.leadSourceId) {
        const leadSource = await prisma.leadSource.findFirst({
            where: {
                id: Number(data.leadSourceId),
                isActive: true,
                OR: [
                    { companyId: null },
                    { companyId: actor.companyId }
                ]
            }
        })
        if (!leadSource) throw new NotFoundError("Lead source")
    }

    // Validate new assignedTo — must be same company
    if (data.assignedToId) {
        const assignedUser = await prisma.user.findFirst({
            where: {
                id: Number(data.assignedToId),
                companyId: actor.companyId
            }
        })
        if (!assignedUser) {
            throw new ForbiddenError("Assigned user does not belong to your company")
        }
    }

    // Strip immutable and protected fields
    const {
        prospectCode,  // IMMUTABLE — never update
        currentStage,  // use /stage endpoint
        companyId,     // cannot change
        branchId,      // cannot change
        createdById,   // cannot change
        ...updateData
    } = data

    return prisma.prospect.update({
        where: { id: Number(id) },
        data: updateData,
        include: {
            company: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            leadSource: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true } }
        }
    })
}

// ══════════════════════════════════════════════════════════
// BE-2-04 | STAGE TRANSITION
// ══════════════════════════════════════════════════════════

export const transitionStageService = async (id, data, actor) => {

    const { new_stage, note, manager_approval_id } = data

    // ── VALIDATE INPUT ────────────────────────────────────
    const errors = []
    if (!new_stage) errors.push({ field: "new_stage", message: "new_stage is required" })
    if (errors.length > 0) throw new ValidationError("Validation failed", errors)

    if (!isValidStage(new_stage)) {
        throw new BadRequestError(
            `Invalid stage. Must be one of: ${Object.values(STAGES).join(", ")}`
        )
    }

    // ── FIND PROSPECT IN SCOPE ────────────────────────────
    const scopeWhere = await getScopeWhere(actor)

    const prospect = await prisma.prospect.findFirst({
        where: { id: Number(id), ...scopeWhere }
    })

    if (!prospect) throw new NotFoundError("Prospect")

    // Company isolation
    assertCompanyScope(actor, prospect.companyId)

    const currentStage = prospect.currentStage

    // ── SAME STAGE CHECK ──────────────────────────────────
    if (currentStage === new_stage) {
        throw new BadRequestError("Prospect is already in this stage")
    }

    // ── ARCHIVED UNARCHIVE RULE ───────────────────────────
    if (currentStage === STAGES.ARCHIVED) {
        if (!manager_approval_id) {
            throw new ForbiddenError(
                "Cannot unarchive without manager approval. Provide manager_approval_id."
            )
        }

        // Validate approver belongs to same company
        // and has canDelete permission on PROSPECT (manager level or above)
        const approver = await prisma.user.findFirst({
            where: {
                id: Number(manager_approval_id),
                companyId: actor.companyId
            },
            include: {
                userRoles: {
                    include: {
                        role: {
                            include: { rolePermissions: true }
                        }
                    }
                }
            }
        })

        if (!approver) {
            throw new NotFoundError("Approver not found in your company")
        }

        // Check approver has PROSPECT canDelete permission
        const approverCanApprove = approver.userRoles.some(ur =>
            ur.role.rolePermissions.some(rp =>
                rp.module === "PROSPECT" && rp.canDelete
            )
        )

        if (!approverCanApprove) {
            throw new ForbiddenError("Approver does not have permission to approve unarchive")
        }
    }

    // ── TRANSITION ALLOWED CHECK ──────────────────────────
    if (!canTransition(currentStage, new_stage)) {
        throw new BadRequestError(
            `Stage transition not allowed. Cannot move from ${currentStage} to ${new_stage}.`
        )
    }

    // ── WIN RULE ──────────────────────────────────────────
    if (new_stage === STAGES.WIN) {
        const winErrors = []
        if (!prospect.tokenAmount || Number(prospect.tokenAmount) <= 0) {
            winErrors.push({
                field: "tokenAmount",
                message: "Token amount must be greater than 0 to mark as Win"
            })
        }
        if (!prospect.joiningDate) {
            winErrors.push({
                field: "joiningDate",
                message: "Joining date must be set to mark as Win"
            })
        }
        if (winErrors.length > 0) throw new ValidationError("Win conditions not met", winErrors)
    }

    // ── UPDATE STAGE + INSERT HISTORY IN TRANSACTION ──────
    const [updatedProspect] = await prisma.$transaction([

        prisma.prospect.update({
            where: { id: Number(id) },
            data: {
                currentStage: new_stage,
                ...(new_stage === STAGES.ARCHIVED ? {
                    archivedAt: new Date(),
                    archivedById: actor.id
                } : {}),
                ...(currentStage === STAGES.ARCHIVED ? {
                    unarchivedAt: new Date(),
                    unarchivedById: actor.id,
                    managerApprovalId: Number(manager_approval_id)
                } : {}),
                ...(new_stage === STAGES.WIN ? {
                    winDate: new Date()
                } : {})
            }
        }),

        prisma.stageHistory.create({
            data: {
                prospectId: Number(id),
                oldStage: currentStage,
                newStage: new_stage,
                changedById: actor.id,
                note: note || null
            }
        })
    ])

    return {
        id: updatedProspect.id,
        prospectCode: prospect.prospectCode,
        oldStage: currentStage,
        newStage: new_stage,
        changedAt: new Date(),
        changedBy: { id: actor.id, name: actor.name }
    }
}

// ══════════════════════════════════════════════════════════
// LEAD SOURCES — GET ALL (for dropdown)
// ══════════════════════════════════════════════════════════

export const getLeadSourcesService = async (actor) => {
    return prisma.leadSource.findMany({
        where: {
            isActive: true,
            OR: [
                { companyId: null },
                { companyId: actor.companyId }
            ]
        },
        orderBy: { name: "asc" }
    })
}