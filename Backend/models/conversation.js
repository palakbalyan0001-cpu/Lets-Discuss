const mongoose = require("mongoose");
// Direct message conversation: 1-to-1 or group DM
const conversationSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "workspaces", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    isGroup: { type: Boolean, default: false },
    // only for 1-to-1: "<workspaceId>:<smallerUserId>:<largerUserId>" so a pair can't have two DMs
    key: { type: String, unique: true, sparse: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  },
  { timestamps: true }
);
conversationSchema.index({ workspace: 1, participants: 1 });
module.exports = mongoose.model("conversations", conversationSchema);
