// src/modules/team/team.routes.js

import { Router } from "express";
import prisma from "../../config/db.js";
import {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  toggleTeamStatus,
  deleteTeam,
  removeTeamMember,
  replaceTeamOwner
} from "./team.controllers.js";
import {
  createTeamSchema,
  updateTeamSchema,
  toggleTeamStatusSchema,
  replaceTeamOwnerSchema,
  validateBody
} from "./team.validation.js";
import { authenticate } from "../../middleware/Authenticate.js";
import { hasPermission } from "../../middleware/hasPermission.js";

const router = Router();

// Secure all endpoints with authentication middleware
router.use(authenticate);

// GET /api/teams/membership/active - Fetch active team of logged-in user and leadership status
router.get(
  "/membership/active",
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      // 1. Check if user is the active Team Leader (bdeId of an ACTIVE, non-deleted team)
      const ledTeam = await prisma.team.findFirst({
        where: { bdeId: userId, status: "ACTIVE", isDeleted: false },
        select: {
          id: true,
          name: true,
          code: true,
          bdeId: true,
          members: {
            where: { removedAt: null },
            select: {
              userId: true,
              user: { select: { id: true, name: true, email: true } }
            }
          }
        }
      });

      // 2. Check if user is a member of an active team
      const membership = await prisma.teamMember.findFirst({
        where: { userId, removedAt: null, team: { status: "ACTIVE", isDeleted: false } },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              code: true,
              bdeId: true,
              members: {
                where: { removedAt: null },
                select: {
                  userId: true,
                  user: { select: { id: true, name: true, email: true } }
                }
              }
            }
          }
        }
      });

      const memberTeam = membership ? membership.team : null;
      const isTeamLeader = Boolean(ledTeam);
      const team = ledTeam || memberTeam;

      return res.json({
        success: true,
        data: {
          team,
          isTeamLeader,
          ledTeam,
          memberTeam
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/teams - Create a new team
router.post(
  "/",
  hasPermission("TEAM", "canCreate"),
  validateBody(createTeamSchema),
  createTeam
);

// GET /api/teams - List, filter, search, and paginate teams
router.get(
  "/",
  hasPermission("TEAM", "canView"),
  getTeams
);

// GET /api/teams/:id - Fetch complete details of a single team
router.get(
  "/:id",
  hasPermission("TEAM", "canView"),
  getTeamById
);

// PUT /api/teams/:id - Update name, status, and BDE owner of a team
router.put(
  "/:id",
  hasPermission("TEAM", "canEdit"),
  validateBody(updateTeamSchema),
  updateTeam
);

// PATCH /api/teams/:id/status - Toggle active/inactive status of a team
router.patch(
  "/:id/status",
  hasPermission("TEAM", "canEdit"),
  validateBody(toggleTeamStatusSchema),
  toggleTeamStatus
);

// DELETE /api/teams/:id - Soft-delete a team
router.delete(
  "/:id",
  hasPermission("TEAM", "canDelete"),
  deleteTeam
);

// DELETE /api/teams/:id/members/:userId - Remove a member (ISE) from team
router.delete(
  "/:id/members/:userId",
  hasPermission("TEAM", "canEdit"),
  removeTeamMember
);

// PUT /api/teams/:id/owner - Reassign/replace team BDE owner
router.put(
  "/:id/owner",
  hasPermission("TEAM", "canEdit"),
  validateBody(replaceTeamOwnerSchema),
  replaceTeamOwner
);

export default router;
