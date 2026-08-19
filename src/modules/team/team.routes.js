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

// GET /api/teams/membership/active - Fetch active team of logged-in user
router.get(
  "/membership/active",
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      // Check led team first (BDE)
      let team = await prisma.team.findFirst({
        where: { bdeId: userId, isDeleted: false },
        select: { id: true, name: true }
      });
      
      if (!team) {
        // Check membership (ISE)
        const membership = await prisma.teamMember.findFirst({
          where: { userId, removedAt: null },
          include: { team: { select: { id: true, name: true } } }
        });
        if (membership) {
          team = membership.team;
        }
      }
      
      return res.json({ success: true, data: { team } });
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
