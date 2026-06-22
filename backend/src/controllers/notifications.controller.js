"use strict";

const notificationsRepo = require("../repositories/notifications.repository");

exports.list = async (req, res) => {
  const userId = req.session?.user?.id || req.query.userId;
  const unreadOnly = req.query.unread === "true";
  const notifications = await notificationsRepo.list({ userId, unreadOnly });
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({ notifications, unreadCount });
};

exports.create = async (req, res) => {
  const notif = await notificationsRepo.create(req.body);
  res.status(201).json(notif);
};

exports.markRead = async (req, res) => {
  const notif = await notificationsRepo.markRead(req.params.id);
  if (!notif) return res.status(404).json({ error: "Notifica non trovata" });
  res.json(notif);
};

exports.markAllRead = async (req, res) => {
  const userId = req.session?.user?.id || req.body.userId;
  const count = await notificationsRepo.markAllRead(userId);
  res.json({ success: true, markedRead: count });
};

exports.remove = async (req, res) => {
  const ok = await notificationsRepo.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Notifica non trovata" });
  res.json({ success: true });
};
