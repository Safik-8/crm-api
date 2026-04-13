import {
    createProspectService,
    getProspectsService,
    getProspectByIdService,
    updateProspectService,
    transitionStageService,
    getLeadSourcesService
} from "./prospect.service.js"
import { sendSuccess } from "../../utils/response.js"

export const createProspect = async (req, res, next) => {
    try {  
        const prospect = await createProspectService(req.body, req.user)
        return sendSuccess(res, prospect, "Prospect created successfully", 201)
    } catch (err) { next(err) }
}

export const getProspects = async (req, res, next) => {
    try {
        const result = await getProspectsService(req.query, req.user)
        return sendSuccess(res, result, "Prospects fetched")
    } catch (err) { next(err) }
}

export const getProspectById = async (req, res, next) => {
    try {
        const prospect = await getProspectByIdService(req.params.id, req.user)
        return sendSuccess(res, { prospect }, "Prospect fetched")
    } catch (err) { next(err) }
}

export const updateProspect = async (req, res, next) => {
    try {
        const prospect = await updateProspectService(req.params.id, req.body, req.user)
        return sendSuccess(res, { prospect }, "Prospect updated successfully")
    } catch (err) { next(err) }
}

export const transitionStage = async (req, res, next) => {
    try {
        const result = await transitionStageService(req.params.id, req.body, req.user)
        return sendSuccess(res, result, "Stage updated successfully")
    } catch (err) { next(err) }
}

export const getLeadSources = async (req, res, next) => {
    try {
        const leadSources = await getLeadSourcesService(req.user)
        return sendSuccess(res, { leadSources }, "Lead sources fetched")
    } catch (err) { next(err) }
}