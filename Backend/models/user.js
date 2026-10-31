const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    title: { type: String, default: "", trim: true, maxlength: 60 },
    role: { type: String, enum: ["Guest", "user"], default: "user" },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Users", userSchema);
