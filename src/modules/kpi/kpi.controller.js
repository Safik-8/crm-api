// BackEnd/src/modules/kpi/kpi.controller.js

import * as kpiService from "./kpi.service.js";

export const getKpiDashboard = async (req, res, next) => {
  try {
    const tab = req.query.tab || "my";
    const data = await kpiService.getKpiDashboardData(req.user, tab, req.query);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createKpiTarget = async (req, res, next) => {
  try {
    const target = await kpiService.createKpiTarget(req.user, req.body);
    return res.status(201).json({
      success: true,
      message: "KPI target created successfully",
      data: target,
    });
  } catch (error) {
    next(error);
  }
};

export const getKpiDetail = async (req, res, next) => {
  try {
    const target = await kpiService.getKpiDetail(req.user, req.params.id);
    return res.status(200).json({
      success: true,
      data: target,
    });
  } catch (error) {
    next(error);
  }
};

export const updateKpiTarget = async (req, res, next) => {
  try {
    const updated = await kpiService.updateKpiTarget(req.user, req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "KPI target updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteKpiTarget = async (req, res, next) => {
  try {
    const deleted = await kpiService.deleteKpiTarget(req.user, req.params.id);
    return res.status(200).json({
      success: true,
      message: "KPI target deleted successfully",
      data: deleted,
    });
  } catch (error) {
    next(error);
  }
};

export const exportKpiData = async (req, res, next) => {
  try {
    const format = req.query.format || "csv";
    const tab = req.query.tab || "my";
    const exportResult = await kpiService.exportKpiData(req.user, format, tab);
    return res.status(200).json({
      success: true,
      message: "KPI export generated successfully",
      data: exportResult,
    });
  } catch (error) {
    next(error);
  }
};
