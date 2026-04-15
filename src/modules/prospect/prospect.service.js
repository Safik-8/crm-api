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

const assertCompanyScope = (actor, targetCompanyId) => {
    // "No companyId" is treated as super-admin scope (no tenant restriction).
    if (!actor.companyId) return

    if (actor.companyId !== targetCompanyId) {
        throw new ForbiddenError("You cannot access data from another company")
    }
}

// Data visibility is derived from org fields + permissions (not role name strings),
// since users can have multiple roles and scopes.

const getScopeWhere = async (actor) => {

    if (!actor.companyId) return {}

    const prospectPerms = actor.permissions?.PROSPECT || {}

    if (!actor.branchId) {
        return { companyId: actor.companyId }
    }

    if (prospectPerms.canDelete) {
        return {
            companyId: actor.companyId,
            branchId: actor.branchId
        }
    }

    if (prospectPerms.canCreate) {
        return {
            companyId: actor.companyId,
            branchId: actor.branchId,
            assignedToId: actor.id
        }
    }

    if (prospectPerms.canView) {
        // View-only users should still be able to see their branch team's prospects.
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

/** `Prospect.tokenAmount` may be Prisma `Decimal` — WIN rule needs numeric value > 0 */
const prospectHasPositiveTokenAmount = (tokenAmount) => {
    if (tokenAmount == null) return false
    const raw =
        typeof tokenAmount === "object" && tokenAmount !== null && typeof tokenAmount.toString === "function"
            ? tokenAmount.toString()
            : tokenAmount
    const n = Number(raw)
    return Number.isFinite(n) && n > 0
}

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
        duplicate_acknowledged = false,
        companyId: bodyCompanyId,
        branchId: bodyBranchId
    } = data

    const errors = []
    if (!name) errors.push({ field: "name", message: "Name is required" })
    if (!mobile) errors.push({ field: "mobile", message: "Mobile is required" })
    if (!leadSourceId) errors.push({ field: "leadSourceId", message: "Lead source is required" })

    // Tenant users: company + branch always come from the actor (ignore body — prevents spoofing).
    // Super admin (no companyId on user): must choose target org in the body.
    // Company-level users without branchId: must send branchId in body (which branch to attach to).
    let companyId = actor.companyId
    let branchId = actor.branchId

    if (companyId == null) {
        if (!bodyCompanyId) errors.push({ field: "companyId", message: "companyId is required when your account has no company" })
        if (!bodyBranchId) errors.push({ field: "branchId", message: "branchId is required when your account has no company" })
    } else if (branchId == null) {
        if (!bodyBranchId) errors.push({ field: "branchId", message: "branchId is required when your account has no branch" })
    }

    if (errors.length > 0) throw new ValidationError("Validation failed", errors)

    if (companyId == null) {
        companyId = Number(bodyCompanyId)
        branchId = Number(bodyBranchId)
        const branchOk = await prisma.branch.findFirst({
            where: { id: branchId, companyId },
            select: { id: true }
        })
        if (!branchOk) {
            throw new ValidationError("Validation failed", [
                { field: "branchId", message: "Branch not found or does not belong to the given company" }
            ])
        }
    } else if (actor.branchId == null) {
        branchId = Number(bodyBranchId)
        const branchOk = await prisma.branch.findFirst({
            where: { id: branchId, companyId },
            select: { id: true }
        })
        if (!branchOk) {
            throw new ValidationError("Validation failed", [
                { field: "branchId", message: "Branch not found or does not belong to your company" }
            ])
        }
    }

    const createdById = actor.id
    const finalAssignedToId = assignedToId ? Number(assignedToId) : actor.id

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

    if (!leadSource) throw new NotFoundError("Lead source")

    // Duplicate check is company-scoped (prevents cross-company data leakage).
    // `duplicate_acknowledged` is a deliberate override: UI can require confirmation then retry.
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

    const prospectCode = await generateProspectCode(companyId, branchId)

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
                changedAt: new Date(),
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

    const scopeWhere = await getScopeWhere(actor)
    const where = { ...scopeWhere }

    if (stage) where.currentStage = stage
    if (lead_source_id) where.leadSourceId = Number(lead_source_id)
    if (assigned_to) where.assignedToId = Number(assigned_to)

    if (branch_id) {
        const requestedBranchId = Number(branch_id)

        if (actor.branchId && actor.branchId !== requestedBranchId) {
            throw new ForbiddenError("You cannot access prospects from another branch")
        }

        // CEO-level users can filter by branch, but only inside their company.
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

    if (start_date || end_date) {
        where.createdAt = {}
        if (start_date) where.createdAt.gte = new Date(start_date)
        if (end_date) where.createdAt.lte = new Date(end_date)
    }

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

    // Final guard: even if scope logic changes, we never allow cross-company reads.
    assertCompanyScope(actor, prospect.companyId)

    return prospect
}

export const updateProspectService = async (id, data, actor) => {

    const scopeWhere = await getScopeWhere(actor)

    const prospect = await prisma.prospect.findFirst({
        where: { id: Number(id), ...scopeWhere }
    })

    if (!prospect) throw new NotFoundError("Prospect")

    // Company isolation
    assertCompanyScope(actor, prospect.companyId)

    // ISE users can only update prospects assigned to themselves.
    const prospectPerms = actor.permissions?.PROSPECT || {}
    if (prospectPerms.canCreate && !prospectPerms.canDelete) {
        if (prospect.assignedToId !== actor.id) {
            throw new ForbiddenError("You can only edit your own prospects")
        }
    }

    // Validate against the prospect's company (super admin has actor.companyId null).
    const prospectCompanyId = prospect.companyId

    // Validate new leadSource — must belong to same company or global
    if (data.leadSourceId) {
        const leadSource = await prisma.leadSource.findFirst({
            where: {
                id: Number(data.leadSourceId),
                isActive: true,
                OR: [
                    { companyId: null },
                    { companyId: prospectCompanyId }
                ]
            }
        })
        if (!leadSource) throw new NotFoundError("Lead source")
    }

    // Validate new assignedTo — must be in the prospect's company
    if (data.assignedToId) {
        const assignedUser = await prisma.user.findFirst({
            where: {
                id: Number(data.assignedToId),
                companyId: prospectCompanyId
            }
        })
        if (!assignedUser) {
            throw new ForbiddenError("Assigned user does not belong to the prospect's company")
        }
    }

    // Hard-stop updates to protected fields even if client sends them.
    // Stage changes must go through `transitionStageService` to keep history consistent.
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

export const transitionStageService = async (id, data, actor) => {

    const { new_stage, note, manager_approval_id } = data

    const errors = []
    if (!new_stage) errors.push({ field: "new_stage", message: "new_stage is required" })
    if (errors.length > 0) throw new ValidationError("Validation failed", errors)

    if (!isValidStage(new_stage)) {
        throw new BadRequestError(
            `Invalid stage. Must be one of: ${Object.values(STAGES).join(", ")}`
        )
    }

    const scopeWhere = await getScopeWhere(actor)

    const prospect = await prisma.prospect.findFirst({
        where: { id: Number(id), ...scopeWhere }
    })

    if (!prospect) throw new NotFoundError("Prospect")

    // Company isolation
    assertCompanyScope(actor, prospect.companyId)

    const currentStage = prospect.currentStage

    if (currentStage === new_stage) {
        throw new BadRequestError("Prospect is already in this stage")
    }

    // Rule 3: from ARCHIVED, require a valid manager_approval_id (user in prospect’s company with PROSPECT:canDelete).
    // All failures → HTTP 400 + "Stage transition not allowed." (no silent bypass of the state machine).
    if (currentStage === STAGES.ARCHIVED) {
        if (manager_approval_id == null || manager_approval_id === "") {
            throw new BadRequestError("Stage transition not allowed.")
        }

        const approverId = Number(manager_approval_id)
        if (!Number.isInteger(approverId) || approverId < 1) {
            throw new BadRequestError("Stage transition not allowed.")
        }

        const approver = await prisma.user.findFirst({
            where: {
                id: approverId,
                companyId: prospect.companyId
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
            throw new BadRequestError("Stage transition not allowed.")
        }

        const approverCanApprove = approver.userRoles.some(ur =>
            ur.role.rolePermissions.some(rp =>
                rp.module === "PROSPECT" && rp.canDelete
            )
        )

        if (!approverCanApprove) {
            throw new BadRequestError("Stage transition not allowed.")
        }
    }

    // Rule 1: ALLOWED_TRANSITIONS[ARCHIVED] is empty — leaving ARCHIVED is gated above by manager + approver.
    // After those pass, allow any valid non-ARCHIVED target.
    const transitionAllowed =
        currentStage === STAGES.ARCHIVED
            ? new_stage !== STAGES.ARCHIVED && isValidStage(new_stage)
            : canTransition(currentStage, new_stage)

    if (!transitionAllowed) {
        throw new BadRequestError("Stage transition not allowed.")
    }

    // Rule 2: WIN requires token_amount > 0 and joining_date on the prospect (HTTP 400, same message).
    if (new_stage === STAGES.WIN) {
        const tokenOk = prospectHasPositiveTokenAmount(prospect.tokenAmount)
        const dateOk = prospect.joiningDate != null
        if (!tokenOk || !dateOk) {
            throw new BadRequestError("Stage transition not allowed.")
        }
    }

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

        // Rule 4: stage_history — prospect_id, old_stage, new_stage, changed_by (FK), changed_at
        prisma.stageHistory.create({
            data: {
                prospectId: Number(id),
                oldStage: currentStage,
                newStage: new_stage,
                changedById: actor.id,
                changedAt: new Date(),
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