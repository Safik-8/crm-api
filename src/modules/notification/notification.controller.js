import { sendSuccess } from "../../utils/response.js";
import {
  getNotificationsService, getUnreadCountService, getReminderSummaryService,
  markNotificationReadService, markAllReadService, deleteNotificationService, deleteAllNotificationsService,
} from "./notification.service.js";

export const getNotifications    = async (req, res, next) => { try { return sendSuccess(res, await getNotificationsService(req.query, req.user), "Notifications fetched"); } catch (e) { next(e); } };
export const getUnreadCount      = async (req, res, next) => { try { return sendSuccess(res, await getUnreadCountService(req.user), "Unread count fetched"); } catch (e) { next(e); } };
export const getReminderSummary  = async (req, res, next) => { try { return sendSuccess(res, await getReminderSummaryService(req.user), "Reminder summary fetched"); } catch (e) { next(e); } };
export const markAsRead          = async (req, res, next) => { try { return sendSuccess(res, { notification: await markNotificationReadService(req.params.id, req.user) }, "Marked as read"); } catch (e) { next(e); } };
export const markAllRead         = async (req, res, next) => { try { return sendSuccess(res, await markAllReadService(req.user), "All marked as read"); } catch (e) { next(e); } };
export const deleteNotif         = async (req, res, next) => { try { return sendSuccess(res, await deleteNotificationService(req.params.id, req.user), "Notification deleted"); } catch (e) { next(e); } };
export const deleteAllNotifs     = async (req, res, next) => { try { return sendSuccess(res, await deleteAllNotificationsService(req.user), "All notifications deleted"); } catch (e) { next(e); } };
