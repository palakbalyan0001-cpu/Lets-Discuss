const mongoose = require("mongoose");
// Roles: Owner_Id = Admin, ids in `guests` = Guest (limited access), everyone else in `member` = Member
const Workspaces = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    Owner_Id: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    inviteLink: { type: String, required: true, unique: true },
    member: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    guests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  },
  { timestamps: true }
);
module.exports = mongoose.model("workspaces", Workspaces);
