const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const Message = require("../models/message");
const { getConversation, same, roleOf } = require("../utils/access");
const { createMessage, removeFile, room, UPLOAD_DIR } = require("../utils/messages");
const { touchRead } = require("../utils/views");
const { hasValidSignature } = require("../middleware/upload");

const fail = (res, error) => {
  console.log(error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};
const notFound = (res) => res.status(404).json({ success: false, message: "Not found or no access" });
const kindOf = (msg) => (msg.channel ? "channel" : "dm");
const convIdOf = (msg) => (msg.channel ? msg.channel : msg.dm);

// GET /channels/:id/messages  and  GET /dms/:id/messages  (?before=<messageId>&limit=50)
const listMessages = (kind) => async (req, res) => {
  try {
    const conv = await getConversation(kind, req.params.id, req.user.id);
    if (!conv) return notFound(res);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const filter = { [kind === "channel" ? "channel" : "dm"]: conv.doc._id };
    if (req.query.before && mongoose.isValidObjectId(req.query.before)) filter._id = { $lt: req.query.before };
    const docs = await Message.find(filter).sort({ _id: -1 }).limit(limit).populate("sender", "name email");
    return res.status(200).json({ success: true, data: docs.reverse(), hasMore: docs.length === limit });
  } catch (error) {
    return fail(res, error);
  }
};

// POST /channels/:id/read  and  POST /dms/:id/read
const markRead = (kind) => async (req, res) => {
  try {
    const conv = await getConversation(kind, req.params.id, req.user.id);
    if (!conv) return notFound(res);
    await touchRead(req.user.id, conv.workspace._id, kind, conv.doc._id);
    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error);
  }
};

// Load a message the requester may access
const loadMessage = async (id, userId) => {
  if (!mongoose.isValidObjectId(id)) return null;
  const msg = await Message.findById(id);
  if (!msg) return null;
  const conv = await getConversation(kindOf(msg), convIdOf(msg), userId);
  return conv ? { msg, conv } : null;
};

// PATCH /messages/:id  { text }   (only the author)
const editMessage = async (req, res) => {
  try {
    const found = await loadMessage(req.params.id, req.user.id);
    if (!found || found.msg.deleted) return notFound(res);
    const { msg, conv } = found;
    if (msg.type === "github" || !same(msg.sender, req.user.id)) {
      return res.status(403).json({ success: false, message: "You can only edit your own messages" });
    }
    const text = String(req.body.text || "").trim();
    if (text.length > 4000) return res.status(400).json({ success: false, message: "Message too long" });
    if (!text && !(msg.attachment && msg.attachment.storedName)) {
      return res.status(400).json({ success: false, message: "Message can't be empty" });
    }
    msg.text = text;
    msg.edited = true;
    await msg.save();
    const message = await msg.populate("sender", "name email");
    const io = req.app.get("io");
    if (io) io.to(room(conv.kind, conv.doc._id)).emit("message:updated", message);
    return res.status(200).json({ success: true, data: message });
  } catch (error) {
    return fail(res, error);
  }
};

// DELETE /messages/:id  (author or workspace admin) - soft delete keeps the timeline intact
const deleteMessage = async (req, res) => {
  try {
    const found = await loadMessage(req.params.id, req.user.id);
    if (!found || found.msg.deleted) return notFound(res);
    const { msg, conv } = found;
    const isAdmin = roleOf(conv.workspace, req.user.id) === "admin";
    if (!isAdmin && !same(msg.sender, req.user.id)) {
      return res.status(403).json({ success: false, message: "You can only delete your own messages" });
    }
    removeFile(msg.attachment && msg.attachment.storedName);
    msg.text = "";
    msg.deleted = true;
    msg.attachment = undefined;
    await msg.save();
    const io = req.app.get("io");
    if (io) {
      io.to(room(conv.kind, conv.doc._id)).emit("message:deleted", {
        _id: String(msg._id),
        kind: conv.kind,
        conversationId: String(conv.doc._id),
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error);
  }
};

// POST /messages/upload  (multipart: file, kind, id, text?)
const uploadMessage = async (req, res) => {
  const file = req.file;
  const cleanup = () => file && fs.unlink(file.path, () => {});
  try {
    if (!file) return res.status(400).json({ success: false, message: "Choose a file to upload" });
    const kind = String(req.body.kind || "");
    const conv = await getConversation(kind, req.body.id, req.user.id);
    if (!conv) {
      cleanup();
      return notFound(res);
    }
    if (conv.role === "guest") {
      cleanup();
      return res.status(403).json({ success: false, message: "Guests cannot upload files" });
    }
    if (!hasValidSignature(file.path, file.mimetype)) {
      cleanup();
      return res.status(400).json({ success: false, message: "File content doesn't match its type" });
    }
    const text = String(req.body.text || "").trim().slice(0, 4000);
    const message = await createMessage({
      io: req.app.get("io"),
      conv,
      sender: req.user.id,
      text,
      type: "file",
      attachment: {
        name: path.basename(file.originalname).slice(0, 120),
        mimetype: file.mimetype,
        size: file.size,
        storedName: file.filename,
      },
    });
    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    cleanup();
    return fail(res, error);
  }
};

// GET /files/:messageId  - only people who can see the conversation can download
const downloadFile = async (req, res) => {
  try {
    const found = await loadMessage(req.params.id, req.user.id);
    const att = found && found.msg.attachment;
    if (!found || found.msg.deleted || !att || !att.storedName) return notFound(res);
    const isImage = att.mimetype.startsWith("image/");
    const disposition = isImage && !req.query.download ? "inline" : "attachment";
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Type", isImage ? att.mimetype : "application/octet-stream");
    res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(att.name)}`);
    return res.sendFile(path.join(UPLOAD_DIR, path.basename(att.storedName)), (err) => {
      if (err && !res.headersSent) res.status(404).json({ success: false, message: "File is missing" });
    });
  } catch (error) {
    return fail(res, error);
  }
};

module.exports = { listMessages, markRead, editMessage, deleteMessage, uploadMessage, downloadFile };
