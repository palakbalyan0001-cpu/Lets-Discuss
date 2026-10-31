const mongoose = require("mongoose");
const Conversation = require("../models/conversation");
const { getWorkspaceForMember, roleOf, has } = require("../utils/access");
const { dmView, touchRead } = require("../utils/views");

const fail = (res, error) => {
  console.log(error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};

const MAX_GROUP = 8;

// POST /workspaces/:id/dms  { userIds: [...] }
// 1 other user -> one-to-one DM (re-used if it exists); 2+ users -> group DM
const createOrGetDm = async (req, res) => {
  try {
    const workspace = await getWorkspaceForMember(req.params.id, req.user.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found or you are not a member" });
    }
    const me = String(req.user.id);
    const ids = [...new Set((Array.isArray(req.body.userIds) ? req.body.userIds : []).map(String))].filter(
      (id) => id !== me
    );
    if (!ids.length || ids.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: "Pick at least one person" });
    }
    if (ids.some((id) => !has(workspace.member, id))) {
      return res.status(400).json({ success: false, message: "Everyone must be a member of this workspace" });
    }
    if (ids.length + 1 > MAX_GROUP) {
      return res.status(400).json({ success: false, message: `Group DMs can have at most ${MAX_GROUP} people` });
    }
    const isGroup = ids.length > 1;
    if (isGroup && roleOf(workspace, req.user.id) === "guest") {
      return res.status(403).json({ success: false, message: "Guests cannot start group DMs" });
    }

    const all = [me, ...ids].sort();
    let dm;
    if (!isGroup) {
      const key = `${workspace._id}:${all.join(":")}`;
      dm = await Conversation.findOne({ key });
      if (!dm) {
        try {
          dm = await new Conversation({ workspace: workspace._id, participants: all, key, createdBy: me }).save();
        } catch (e) {
          if (e.code !== 11000) throw e;
          dm = await Conversation.findOne({ key }); // created at the same moment by the other person
        }
      }
    } else {
      dm = await Conversation.findOne({
        workspace: workspace._id,
        isGroup: true,
        participants: { $all: all, $size: all.length },
      });
      if (!dm) dm = await new Conversation({ workspace: workspace._id, participants: all, isGroup: true, createdBy: me }).save();
    }
    await dm.populate("participants", "name email");
    await touchRead(me, workspace._id, "dm", dm._id); // my own side starts "read"

    const view = dmView(dm);
    const io = req.app.get("io");
    if (io) all.forEach((uid) => io.to(`user:${uid}`).emit("dm:created", view));
    return res.status(200).json({ success: true, data: view });
  } catch (error) {
    return fail(res, error);
  }
};

module.exports = { createOrGetDm };
