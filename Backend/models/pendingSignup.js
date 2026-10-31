const mongoose = require("mongoose");
// A signup that is waiting for its email code. The real user is only created after the code is verified.
const pendingSignupSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true }, // already bcrypt-hashed - the plain password is never stored
    otpHash: { type: String, required: true },      // HMAC of the code - the code itself is never stored
    expiresAt: { type: Date, required: true },      // the code stops working here
    attempts: { type: Number, default: 0 },         // wrong guesses
    sendCount: { type: Number, default: 0 },        // codes emailed so far
    lastSentAt: { type: Date, default: Date.now },
    // MongoDB removes the whole record automatically a while after the code expired
    deleteAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);
module.exports = mongoose.model("pendingsignups", pendingSignupSchema);
