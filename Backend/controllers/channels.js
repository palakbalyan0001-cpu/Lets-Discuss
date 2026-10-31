const mongoose = require("mongoose");
const Channel = require("../models/channel");
const Message = require("../models/message");
const ReadState = require("../models/readstate");
const { removeFile } = require("../utils/messages");
const { channelView, touchRead } = require("../utils/views");
const { getWorkspaceForMember, roleOf, has } = require("../utils/access");

const fail = (res, error) => {
  console.log(error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};

// Load a channel + the requester's workspace role (channel need not be joined)
const loadChannel = async (channelId, userId) => {
  if (!mongoose.isValidObjectId(channelId)) return null;
  const channel = await Channel.findById(channelId);
  if (!channel) return null;
  const workspace = await getWorkspaceForMember(channel.workspace, userId);
  if (!workspace) return null;
  return { channel, workspace, role: roleOf(workspace, userId) };
};

const notFound = (res) => res.status(404).json({ success: false, message: "Channel not found" });

const joinChannel = async (req, res) => {
  try {
    const c = await loadChannel(req.params.id, req.user.id);
    if (!c) return notFound(res);
    if (c.role === "guest" && !c.channel.isDefault) {
      return res.status(403).json({ success: false, message: "Guests can only use #general" });
    }
    await Channel.updateOne({ _id: c.channel._id }, { $addToSet: { members: req.user.id } });
    await touchRead(req.user.id, c.workspace._id, "channel", c.channel._id);
    const fresh = await Channel.findById(c.channel._id);
    return res.status(200).json({ success: true, data: channelView(fresh, req.user.id) });
  } catch (error) {
    return fail(res, error);
  }
};

const leaveChannel = async (req, res) => {
  try {
    const c = await loadChannel(req.params.id, req.user.id);
    if (!c) return notFound(res);
    if (c.channel.isDefault) {
      return res.status(400).json({ success: false, message: "You can't leave #general" });
    }
    await Channel.updateOne({ _id: c.channel._id }, { $pull: { members: req.user.id } });
    await ReadState.deleteOne({ user: req.user.id, target: c.channel._id });
    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error);
  }
};

// Admin only; #general can't be deleted
const deleteChannel = async (req, res) => {
  try {
    const c = await loadChannel(req.params.id, req.user.id);
    if (!c) return notFound(res);
    if (c.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only the admin can delete channels" });
    }
    if (c.channel.isDefault) {
      return res.status(400).json({ success: false, message: "#general can't be deleted" });
    }
    const files = await Message.find({ channel: c.channel._id, "attachment.storedName": { $exists: true } });
    files.forEach((m) => removeFile(m.attachment.storedName));
    await Promise.all([
      Message.deleteMany({ channel: c.channel._id }),
      ReadState.deleteMany({ target: c.channel._id }),
      Channel.deleteOne({ _id: c.channel._id }),
    ]);
    const io = req.app.get("io");
    if (io) {
      io.to(`workspace:${c.workspace._id}`).emit("channel:deleted", {
        workspaceId: String(c.workspace._id),
        channelId: String(c.channel._id),
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error);
  }
};

module.exports = { joinChannel, leaveChannel, deleteChannel };
