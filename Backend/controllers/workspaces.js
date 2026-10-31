const User = require("../models/user");
const Workspace = require("../models/workspaces");
const Channel = require("../models/channel");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const ReadState = require("../models/readstate");
const inviteEmail = require("../utils/inviteEmail");
const generateLink = require("../utils/inviteLink");
const { removeFile } = require("../utils/messages");
const { channelView, dmView, getUnread, touchRead } = require("../utils/views");
const { getWorkspaceForMember, cleanEmails, roleOf, same, has } = require("../utils/access");

const CLIENT_URL = () => process.env.CLIENT_URL || "http://localhost:5173";
const joinUrl = (code) => `${CLIENT_URL()}/join/${code}`;
const fail = (res, error) => {
  console.log(error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};
const notMember = (res) =>
  res.status(404).json({ success: false, message: "Workspace not found or you are not a member" });

// Sends invites; never throws. Returns emails that failed.
const sendInvites = async (emails, senderEmail, workspace) => {
  const results = await Promise.allSettled(
    emails.map((e) => inviteEmail(e, senderEmail, workspace.name, joinUrl(workspace.inviteLink)))
  );
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.log("invite failed for", emails[i], r.reason && r.reason.message);
      failed.push(emails[i]);
    }
  });
  return failed;
};

const createWorkspaces = async (req, res) => {
  try {
    const { workspaceName, emails } = req.body;
    const name = String(workspaceName || "").trim();
    if (name.length < 3 || name.length > 50) {
      return res.status(400).json({ success: false, message: "Workspace name must be 3-50 characters" });
    }
    const { valid, invalid } = cleanEmails(emails);
    if (invalid.length) {
      return res.status(400).json({ success: false, message: `Invalid email(s): ${invalid.join(", ")}` });
    }

    const workspace = await new Workspace({
      name,
      Owner_Id: req.user.id,
      inviteLink: await generateLink(),
      member: [req.user.id],
    }).save();
    await new Channel({
      name: "general",
      description: "Company-wide announcements and chat",
      workspace: workspace._id,
      createdBy: req.user.id,
      isDefault: true,
      members: [req.user.id],
    }).save();

    let failedEmails = [];
    if (valid.length) {
      const sender = await User.findById(req.user.id);
      failedEmails = await sendInvites(valid, sender.email, workspace);
    }
    return res.status(201).json({ success: true, message: "Workspace created successfully", data: workspace, failedEmails });
  } catch (error) {
    return fail(res, error);
  }
};

// Workspaces I created (role admin) + workspaces I was invited to (member / guest)
const getMyWorkspaces = async (req, res) => {
  try {
    const list = await Workspace.find({ member: req.user.id }).sort({ createdAt: -1 });
    const data = list.map((w) => ({
      _id: w._id,
      name: w.name,
      isOwner: same(w.Owner_Id, req.user.id),
      role: roleOf(w, req.user.id),
      memberCount: w.member.length,
    }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return fail(res, error);
  }
};

const getWorkspace = async (req, res) => {
  try {
    const workspace = await getWorkspaceForMember(req.params.id, req.user.id);
    if (!workspace) return notMember(res);
    const myRole = roleOf(workspace, req.user.id);

    const [allChannels, users, dms] = await Promise.all([
      Channel.find({ workspace: workspace._id }).sort({ createdAt: 1 }),
      User.find({ _id: { $in: workspace.member } }).select("name email title"),
      Conversation.find({ workspace: workspace._id, participants: req.user.id })
        .sort({ updatedAt: -1 })
        .populate("participants", "name email"),
    ]);
    // guests only see the default channel
    const visible = myRole === "guest" ? allChannels.filter((c) => c.isDefault) : allChannels;
    const channels = visible.map((c) => channelView(c, req.user.id));
    const members = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      title: u.title,
      role: roleOf(workspace, u._id),
    }));

    const unread = await getUnread(
      req.user.id,
      workspace._id,
      channels.filter((c) => c.joined).map((c) => c._id),
      dms.map((d) => d._id)
    );

    return res.status(200).json({
      success: true,
      data: {
        _id: workspace._id,
        name: workspace.name,
        ownerId: workspace.Owner_Id,
        myRole,
        inviteLink: myRole === "guest" ? null : workspace.inviteLink,
        channels,
        members,
        dms: dms.map(dmView),
        unread,
      },
    });
  } catch (error) {
    return fail(res, error);
  }
};

// Invite more people by email (admin / member, not guests)
const inviteMembers = async (req, res) => {
  try {
    const workspace = await getWorkspaceForMember(req.params.id, req.user.id);
    if (!workspace) return notMember(res);
    if (roleOf(workspace, req.user.id) === "guest") {
      return res.status(403).json({ success: false, message: "Guests cannot invite people" });
    }
    const { valid, invalid } = cleanEmails(req.body.emails);
    if (invalid.length) {
      return res.status(400).json({ success: false, message: `Invalid email(s): ${invalid.join(", ")}` });
    }
    if (!valid.length) {
      return res.status(400).json({ success: false, message: "Add at least one email" });
    }
    const sender = await User.findById(req.user.id);
    const failedEmails = await sendInvites(valid, sender.email, workspace);
    return res.status(200).json({
      success: true,
      message: `Invited ${valid.length - failedEmails.length} of ${valid.length}`,
      failedEmails,
    });
  } catch (error) {
    return fail(res, error);
  }
};

// Info shown on the join page before the user accepts
const inviteInfo = async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ inviteLink: req.params.code });
    if (!workspace) {
      return res.status(404).json({ success: false, message: "This invite link is invalid" });
    }
    return res.status(200).json({
      success: true,
      data: {
        _id: workspace._id,
        name: workspace.name,
        memberCount: workspace.member.length,
        alreadyMember: has(workspace.member, req.user.id),
      },
    });
  } catch (error) {
    return fail(res, error);
  }
};

const joinWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findOneAndUpdate(
      { inviteLink: req.params.code },
      { $addToSet: { member: req.user.id } },
      { returnDocument: "after" }
    );
    if (!workspace) {
      return res.status(404).json({ success: false, message: "This invite link is invalid" });
    }
    // new members start with #general "read" so they don't see its whole history as unread
    const general = await Channel.findOne({ workspace: workspace._id, isDefault: true });
    if (general) await touchRead(req.user.id, workspace._id, "channel", general._id);

    const io = req.app.get("io");
    const user = await User.findById(req.user.id).select("name email title");
    if (io && user) {
      io.to(`workspace:${workspace._id}`).emit("member:joined", {
        workspaceId: String(workspace._id),
        user: { _id: user._id, name: user.name, email: user.email, title: user.title, role: roleOf(workspace, user._id) },
      });
    }
    return res.status(200).json({ success: true, data: { _id: workspace._id, name: workspace.name } });
  } catch (error) {
    return fail(res, error);
  }
};

const createChannel = async (req, res) => {
  try {
    const workspace = await getWorkspaceForMember(req.params.id, req.user.id);
    if (!workspace) return notMember(res);
    if (roleOf(workspace, req.user.id) === "guest") {
      return res.status(403).json({ success: false, message: "Guests cannot create channels" });
    }
    const name = String(req.body.name || "")
      .trim()
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/\s+/g, "-");
    if (!/^[a-z0-9][a-z0-9-_]{1,29}$/.test(name)) {
      return res.status(400).json({
        success: false,
        message: "Channel name: 2-30 characters, letters, numbers, - or _",
      });
    }
    const description = String(req.body.description || "").trim().slice(0, 200);
    const channel = await new Channel({
      name,
      description,
      workspace: workspace._id,
      createdBy: req.user.id,
      members: [req.user.id],
    }).save();
    await touchRead(req.user.id, workspace._id, "channel", channel._id);

    const io = req.app.get("io");
    if (io) io.to(`workspace:${workspace._id}`).emit("channel:created", channelView(channel, null));
    return res.status(201).json({ success: true, data: channelView(channel, req.user.id) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A channel with this name already exists" });
    }
    return fail(res, error);
  }
};

// Admin only: delete the whole workspace and everything in it
const deleteWorkspace = async (req, res) => {
  try {
    const workspace = await getWorkspaceForMember(req.params.id, req.user.id);
    if (!workspace) return notMember(res);
    if (roleOf(workspace, req.user.id) !== "admin") {
      return res.status(403).json({ success: false, message: "Only the workspace admin can delete it" });
    }
    const files = await Message.find({ workspace: workspace._id, "attachment.storedName": { $exists: true } });
    files.forEach((m) => removeFile(m.attachment.storedName));

    const io = req.app.get("io");
    if (io) io.to(`workspace:${workspace._id}`).emit("workspace:deleted", { workspaceId: String(workspace._id) });

    await Promise.all([
      Message.deleteMany({ workspace: workspace._id }),
      Channel.deleteMany({ workspace: workspace._id }),
      Conversation.deleteMany({ workspace: workspace._id }),
      ReadState.deleteMany({ workspace: workspace._id }),
      Workspace.deleteOne({ _id: workspace._id }),
    ]);
    return res.status(200).json({ success: true, message: "Workspace deleted" });
  } catch (error) {
    return fail(res, error);
  }
};

// Remove a user from a workspace (used for leave + admin remove)
const detachUser = async (workspace, userId, io) => {
  await Promise.all([
    Workspace.updateOne({ _id: workspace._id }, { $pull: { member: userId, guests: userId } }),
    Channel.updateMany({ workspace: workspace._id }, { $pull: { members: userId } }),
    ReadState.deleteMany({ user: userId, workspace: workspace._id }),
  ]);
  if (io) {
    io.to(`workspace:${workspace._id}`).emit("member:left", {
      workspaceId: String(workspace._id),
      userId: String(userId),
    });
    io.to(`user:${userId}`).emit("workspace:removed", { workspaceId: String(workspace._id) });
  }
};

const leaveWorkspace = async (req, res) => {
  try {
    const workspace = await getWorkspaceForMember(req.params.id, req.user.id);
    if (!workspace) return notMember(res);
    if (roleOf(workspace, req.user.id) === "admin") {
      return res.status(400).json({ success: false, message: "The admin can't leave - delete the workspace instead" });
    }
    await detachUser(workspace, req.user.id, req.app.get("io"));
    return res.status(200).json({ success: true, message: "You left the workspace" });
  } catch (error) {
    return fail(res, error);
  }
};

const removeMember = async (req, res) => {
  try {
    const workspace = await getWorkspaceForMember(req.params.id, req.user.id);
    if (!workspace) return notMember(res);
    if (roleOf(workspace, req.user.id) !== "admin") {
      return res.status(403).json({ success: false, message: "Only the admin can remove members" });
    }
    if (same(req.params.userId, workspace.Owner_Id)) {
      return res.status(400).json({ success: false, message: "The admin can't be removed" });
    }
    if (!has(workspace.member, req.params.userId)) {
      return res.status(404).json({ success: false, message: "That user is not a member" });
    }
    await detachUser(workspace, req.params.userId, req.app.get("io"));
    return res.status(200).json({ success: true, message: "Member removed" });
  } catch (error) {
    return fail(res, error);
  }
};

// Admin: switch a member between "member" and "guest"
const setMemberRole = async (req, res) => {
  try {
    const workspace = await getWorkspaceForMember(req.params.id, req.user.id);
    if (!workspace) return notMember(res);
    if (roleOf(workspace, req.user.id) !== "admin") {
      return res.status(403).json({ success: false, message: "Only the admin can change roles" });
    }
    const role = req.body.role;
    if (!["member", "guest"].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be member or guest" });
    }
    if (same(req.params.userId, workspace.Owner_Id) || !has(workspace.member, req.params.userId)) {
      return res.status(400).json({ success: false, message: "Can't change this user's role" });
    }
    await Workspace.updateOne(
      { _id: workspace._id },
      role === "guest" ? { $addToSet: { guests: req.params.userId } } : { $pull: { guests: req.params.userId } }
    );
    const io = req.app.get("io");
    if (io) {
      io.to(`workspace:${workspace._id}`).emit("member:role", {
        workspaceId: String(workspace._id),
        userId: String(req.params.userId),
        role,
      });
    }
    return res.status(200).json({ success: true, role });
  } catch (error) {
    return fail(res, error);
  }
};

module.exports = {
  createWorkspaces, getMyWorkspaces, getWorkspace, inviteMembers, inviteInfo, joinWorkspace,
  createChannel, deleteWorkspace, leaveWorkspace, removeMember, setMemberRole,
};
