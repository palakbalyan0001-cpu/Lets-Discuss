const mongoose = require("mongoose");
const Channel = require("../models/channel");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const User = require("../models/user");
const { getWorkspaceForMember, roleOf } = require("../utils/access");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /search?workspaceId=&q=&scope=all|messages|people&channelId=&dmId=&from=&has=file|link&after=&before=
const search = async (req, res) => {
  try {
    const { workspaceId, scope = "all", channelId, dmId, from, has, after, before } = req.query;
    const q = String(req.query.q || "").trim().slice(0, 100);
    const workspace = await getWorkspaceForMember(workspaceId, req.user.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found or you are not a member" });
    }
    const filtersUsed = channelId || dmId || from || has || after || before;
    if (!q && !filtersUsed) {
      return res.status(400).json({ success: false, message: "Type something to search" });
    }
    const out = { success: true, messages: [], users: [] };

    if (scope === "all" || scope === "messages") {
      // Only conversations the requester can see: joined channels + their own DMs
      const role = roleOf(workspace, req.user.id);
      const [channels, dms] = await Promise.all([
        Channel.find(
          role === "guest"
            ? { workspace: workspace._id, isDefault: true }
            : { workspace: workspace._id, $or: [{ isDefault: true }, { members: req.user.id }] }
        ).select("_id"),
        Conversation.find({ workspace: workspace._id, participants: req.user.id }).select("_id"),
      ]);
      let channelIds = channels.map((c) => String(c._id));
      let dmIds = dms.map((d) => String(d._id));
      if (channelId) {
        channelIds = channelIds.filter((id) => id === String(channelId));
        dmIds = [];
      }
      if (dmId) {
        dmIds = dmIds.filter((id) => id === String(dmId));
        channelIds = [];
      }

      const and = [
        { workspace: workspace._id },
        { deleted: { $ne: true } },
        { $or: [{ channel: { $in: channelIds } }, { dm: { $in: dmIds } }] },
      ];
      if (q) and.push({ $or: [{ text: new RegExp(escapeRegex(q), "i") }, { "attachment.name": new RegExp(escapeRegex(q), "i") }] });
      if (from && mongoose.isValidObjectId(from)) and.push({ sender: from });
      if (has === "file") and.push({ type: "file" });
      if (has === "link") and.push({ text: /https?:\/\//i });
      const range = {};
      if (after && !isNaN(new Date(after))) range.$gte = new Date(after);
      if (before && !isNaN(new Date(before))) range.$lte = new Date(new Date(before).getTime() + 24 * 3600 * 1000 - 1);
      if (range.$gte || range.$lte) and.push({ createdAt: range });

      out.messages = await Message.find({ $and: and }).sort({ _id: -1 }).limit(30).populate("sender", "name email");
    }

    if ((scope === "all" || scope === "people") && q) {
      const rx = new RegExp(escapeRegex(q), "i");
      out.users = await User.find({ _id: { $in: workspace.member }, $or: [{ name: rx }, { email: rx }] })
        .select("name email title")
        .limit(10);
    }
    return res.status(200).json(out);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports = { search };
