const mongoose = require("mongoose");
// When a user last read a channel / DM - used to compute unread badges
const readStateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "workspaces", required: true },
  kind: { type: String, enum: ["channel", "dm"], required: true },
  target: { type: mongoose.Schema.Types.ObjectId, required: true },
  lastReadAt: { type: Date, default: Date.now },
});
readStateSchema.index({ user: 1, target: 1 }, { unique: true });
readStateSchema.index({ user: 1, workspace: 1 });
module.exports = mongoose.model("readstates", readStateSchema);
