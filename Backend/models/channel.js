const mongoose = require("mongoose");
const channelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: "", maxlength: 200 },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "workspaces", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    // #general: every workspace member is implicitly in it and nobody can leave/delete it
    isDefault: { type: Boolean, default: false },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    github: {
      repo: { type: String },
      webhookSecret: { type: String },
      linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        if (ret.github) {
          delete ret.github.webhookSecret; // never leaves the server in normal responses
          if (!ret.github.repo) delete ret.github;
        }
        return ret;
      },
    },
  }
);
channelSchema.index({ workspace: 1, name: 1 }, { unique: true });
module.exports = mongoose.model("channels", channelSchema);
