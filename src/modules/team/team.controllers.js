// src/modules/team/team.controllers.js

import {
  createTeamService,
  updateTeamService,
  toggleTeamStatusService,
  softDeleteTeamService,
  getTeamByIdService,
  getTeamsListService,
  removeTeamMemberService,
  replaceTeamOwnerService
} from "./team.services.js";
import { sendSuccess } from "../../utils/response.js";

export const createTeam = async (req, res, next) => {
  try {
    const team = await createTeamService(req.body, req.user, req);
    return sendSuccess(res, { team }, "Team created successfully", 201);
  } catch (err) {
    next(err);
  }
};

export const getTeams = async (req, res, next) => {
  try {
    const result = await getTeamsListService(req.query, req.user);
    return sendSuccess(res, result, "Teams fetched successfully");
  } catch (err) {
    next(err);
  }
};

export const getTeamById = async (req, res, next) => {
  try {
    const team = await getTeamByIdService(req.params.id, req.user);
    return sendSuccess(res, { team }, "Team details fetched successfully");
  } catch (err) {
    next(err);
  }
};

export const updateTeam = async (req, res, next) => {
  try {
    const team = await updateTeamService(req.params.id, req.body, req.user, req);
    return sendSuccess(res, { team }, "Team updated successfully");
  } catch (err) {
    next(err);
  }
};

export const toggleTeamStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const team = await toggleTeamStatusService(req.params.id, status, req.user, req);
    return sendSuccess(res, { team }, "Team status toggled successfully");
  } catch (err) {
    next(err);
  }
};

export const deleteTeam = async (req, res, next) => {
  try {
    const result = await softDeleteTeamService(req.params.id, req.user, req);
    return sendSuccess(res, result, "Team deleted successfully");
  } catch (err) {
    next(err);
  }
};

export const removeTeamMember = async (req, res, next) => {
  try {
    const result = await removeTeamMemberService(req.params.id, req.params.userId, req.user, req);
    return sendSuccess(res, { membership: result }, "Team member removed successfully");
  } catch (err) {
    next(err);
  }
};

export const replaceTeamOwner = async (req, res, next) => {
  try {
    const { bdeId } = req.body;
    const result = await replaceTeamOwnerService(req.params.id, bdeId, req.user, req);
    return sendSuccess(res, { team: result }, "Team owner reassigned successfully");
  } catch (err) {
    next(err);
  }
};

