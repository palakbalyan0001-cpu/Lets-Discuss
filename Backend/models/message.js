const mongoose = require("mongoose");
const messageSchema = new mongoose.Schema(
  {
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "channels" },
    dm: { type: mongoose.Schema.Types.ObjectId, ref: "conversations" },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "workspaces", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "Users" }, // empty for GitHub bot messages
    type: { type: String, enum: ["text", "file", "github"], default: "text" },
    text: { type: String, default: "", trim: true, maxlength: 4000 },
    attachment: {
      name: String,
      mimetype: String,
      size: Number,
      storedName: String,
    },
    meta: { type: mongoose.Schema.Types.Mixed },
    edited: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        if (ret.attachment) delete ret.attachment.storedName; // internal file name stays private
        return ret;
      },
    },
  }
);
messageSchema.pre("validate", function () {
  if (!this.channel === !this.dm) throw new Error("Message needs exactly one of channel or dm");
  if (!this.deleted && !this.text && !(this.attachment && this.attachment.storedName)) {
    throw new Error("Message is empty");
  }
});
messageSchema.index({ channel: 1, createdAt: -1 });
messageSchema.index({ dm: 1, createdAt: -1 });
messageSchema.index({ workspace: 1, createdAt: -1 });
module.exports = mongoose.model("messages", messageSchema);
