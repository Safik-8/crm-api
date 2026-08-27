import { sendSuccess } from "../../utils/response.js";
import {
  getNotificationsService,
  getUnreadCountService,
  getReminderSummaryService,
  markNotificationReadService,
  markAllReadService,
  deleteNotificationService,
  deleteAllNotificationsService,
  getNotificationConfigsService,
  updateNotificationConfigService,
} from "./notification.service.js";

export const getNotifications = async (req, res, next) => {
  try {
    const result = await getNotificationsService(req.query, req.user);
    return sendSuccess(res, result, "Notifications retrieved successfully");
  } catch (err) {
    console.error("=== GET NOTIFICATIONS CONTROLLER ERROR ===", err);
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const result = await getUnreadCountService(req.user);
    return sendSuccess(res, result, "Unread count retrieved successfully");
  } catch (err) {
    next(err);
  }
};

export const getReminderSummary = async (req, res, next) => {
  try {
    const result = await getReminderSummaryService(req.user);
    return sendSuccess(res, result, "Reminder summary retrieved successfully");
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const result = await markNotificationReadService(req.params.id, req.user);
    return sendSuccess(res, result, "Notification marked as read");
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    const result = await markAllReadService(req.user);
    return sendSuccess(res, result, "All notifications marked as read");
  } catch (err) {
    next(err);
  }
};

export const deleteNotif = async (req, res, next) => {
  try {
    const result = await deleteNotificationService(req.params.id, req.user);
    return sendSuccess(res, result, "Notification deleted");
  } catch (err) {
    next(err);
  }
};

export const deleteAllNotifs = async (req, res, next) => {
  try {
    const result = await deleteAllNotificationsService(req.user);
    return sendSuccess(res, result, "All notifications cleared");
  } catch (err) {
    next(err);
  }
};

export const getNotificationConfigs = async (req, res, next) => {
  try {
    const configs = await getNotificationConfigsService(req.user);
    return sendSuccess(res, { configs }, "Notification event configurations retrieved");
  } catch (err) {
    next(err);
  }
};

export const updateNotificationConfig = async (req, res, next) => {
  try {
    const config = await updateNotificationConfigService(req.params.id, req.body, req.user);
    return sendSuccess(res, { config }, "Notification event configuration updated");
  } catch (err) {
    next(err);
  }
};
