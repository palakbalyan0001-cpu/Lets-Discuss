const ReadState = require("../models/readstate");
const Message = require("../models/message");
const { has } = require("./access");

const channelView = (ch, userId) => {
  const o = ch.toJSON();
  o.joined = !!ch.isDefault || (userId ? has(ch.members, userId) : false);
  o.memberCount = ch.isDefault ? null : (ch.members || []).length;
  delete o.members;
  return o;
};

// dm must have participants populated with name/email
const dmView = (dm) => ({
  _id: dm._id,
  workspace: dm.workspace,
  isGroup: dm.isGroup,
  participants: dm.participants,
  createdAt: dm.createdAt,
});

// { [channelOrDmId]: unreadCount } for the given user (capped at 99 per conversation)
const getUnread = async (userId, workspaceId, channelIds, dmIds) => {
  const states = await ReadState.find({ user: userId, workspace: workspaceId });
  const last = {};
  states.forEach((s) => (last[String(s.target)] = s.lastReadAt));
  const out = {};
  const count = async (field, id) => {
    const n = await Message.countDocuments(
      {
        [field]: id,
        createdAt: { $gt: last[String(id)] || new Date(0) },
        sender: { $ne: userId },
        deleted: { $ne: true },
      },
      { limit: 99 }
    );
    if (n) out[String(id)] = n;
  };
  await Promise.all([...channelIds.map((id) => count("channel", id)), ...dmIds.map((id) => count("dm", id))]);
  return out;
};

const touchRead = (userId, workspaceId, kind, target) =>
  ReadState.updateOne(
    { user: userId, target },
    { $set: { lastReadAt: new Date(), workspace: workspaceId, kind } },
    { upsert: true }
  );

module.exports = { channelView, dmView, getUnread, touchRead };
