const mongoose = require("mongoose");
const Workspace = require("../models/workspaces");
const Channel = require("../models/channel");
const Conversation = require("../models/conversation");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const same = (a, b) => String(a) === String(b);
const has = (arr, id) => (arr || []).some((x) => same(x, id));
const roleOf = (workspace, userId) =>
  same(workspace.Owner_Id, userId) ? "admin" : has(workspace.guests, userId) ? "guest" : "member";

// Returns the workspace only if userId is a member, else null
const getWorkspaceForMember = async (workspaceId, userId) => {
  if (!mongoose.isValidObjectId(workspaceId)) return null;
  return Workspace.findOne({ _id: workspaceId, member: userId });
};

// Channel + workspace, only if the user may read/post in it.
// Default channel: any workspace member. Other channels: joined members (guests: never).
const getChannelForMember = async (channelId, userId) => {
  if (!mongoose.isValidObjectId(channelId)) return null;
  const channel = await Channel.findById(channelId);
  if (!channel) return null;
  const workspace = await getWorkspaceForMember(channel.workspace, userId);
  if (!workspace) return null;
  const role = roleOf(workspace, userId);
  if (!channel.isDefault && (role === "guest" || !has(channel.members, userId))) return null;
  return { channel, workspace, role };
};

const getDmForUser = async (dmId, userId) => {
  if (!mongoose.isValidObjectId(dmId)) return null;
  const dm = await Conversation.findOne({ _id: dmId, participants: userId });
  if (!dm) return null;
  const workspace = await getWorkspaceForMember(dm.workspace, userId);
  if (!workspace) return null;
  return { dm, workspace, role: roleOf(workspace, userId) };
};

// Unified access check for "channel" or "dm".
// Returns { kind, doc, workspace, role, recipients: [userId strings] } or null
const getConversation = async (kind, id, userId) => {
  if (kind === "channel") {
    const r = await getChannelForMember(id, userId);
    if (!r) return null;
    const list = r.channel.isDefault ? r.workspace.member : r.channel.members;
    return { kind, doc: r.channel, workspace: r.workspace, role: r.role, recipients: list.map(String) };
  }
  if (kind === "dm") {
    const r = await getDmForUser(id, userId);
    if (!r) return null;
    return { kind, doc: r.dm, workspace: r.workspace, role: r.role, recipients: r.dm.participants.map(String) };
  }
  return null;
};

// Lowercase, trim, validate and de-duplicate a list of emails
const cleanEmails = (emails) => {
  if (!Array.isArray(emails)) return { valid: [], invalid: [] };
  const seen = new Set();
  const valid = [];
  const invalid = [];
  for (const raw of emails) {
    const email = String(raw || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    (EMAIL_REGEX.test(email) ? valid : invalid).push(email);
  }
  return { valid, invalid };
};

module.exports = {
  EMAIL_REGEX, same, has, roleOf,
  getWorkspaceForMember, getChannelForMember, getDmForUser, getConversation, cleanEmails,
};
