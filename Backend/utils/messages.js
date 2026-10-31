const fs = require("fs");
const path = require("path");
const Message = require("../models/message");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const removeFile = (storedName) => {
  if (!storedName) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(storedName)), () => {});
};

// socket.io room name of a conversation
const room = (kind, id) => `${kind}:${id}`;

// Save a message, push it to everyone viewing the conversation and
// send a notification to each member's personal room.
const createMessage = async ({ io, conv, sender, text = "", type = "text", attachment, meta }) => {
  const data = { workspace: conv.workspace._id, text, type };
  data[conv.kind === "channel" ? "channel" : "dm"] = conv.doc._id;
  if (sender) data.sender = sender;
  if (attachment) data.attachment = attachment;
  if (meta) data.meta = meta;

  const saved = await new Message(data).save();
  const message = await saved.populate("sender", "name email");

  if (io) {
    io.to(room(conv.kind, conv.doc._id)).emit("message:new", message);
    for (const uid of conv.recipients) {
      if (sender && String(uid) === String(sender)) continue;
      io.to(`user:${uid}`).emit("notify:message", {
        kind: conv.kind,
        id: String(conv.doc._id),
        workspaceId: String(conv.workspace._id),
        message,
      });
    }
  }
  return message;
};

module.exports = { UPLOAD_DIR, removeFile, room, createMessage };
