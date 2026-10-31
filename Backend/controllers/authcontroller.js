const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const PendingSignup = require("../models/pendingSignup");
const sendOtpEmail = require("../utils/otpEmail");
const { EMAIL_REGEX } = require("../utils/access");

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
// Frontend (Vercel) and backend (Render/Railway) are on DIFFERENT domains in production, so the login
// cookie must be SameSite=None + Secure or the browser will not send it. Locally (http, same site) use "lax".
// If you put both on one custom domain (app.example.com + api.example.com) you may set COOKIE_SAMESITE=lax.
const isProd = process.env.NODE_ENV === "production";
const sameSite = process.env.COOKIE_SAMESITE || (isProd ? "none" : "lax");
const cookieOptions = {
  httpOnly: true,
  sameSite,
  secure: isProd, // required by browsers when sameSite is "none"
  maxAge: TWO_DAYS,
};
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, title: u.title || "" });

// ---------------- email verification (OTP) ----------------
const OTP_MINUTES = () => parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10;
const RESEND_COOLDOWN_SEC = 30;
const MAX_ATTEMPTS = 5; // wrong guesses before the code is burned
const MAX_SENDS = 5;    // emails per pending signup

const hashOtp = (email, otp) =>
  crypto.createHmac("sha256", process.env.SECRET_KEY).update(`${email}:${otp}`).digest("hex");
const makeOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");
const secondsLeft = (pending) =>
  Math.max(0, Math.ceil((pending.lastSentAt.getTime() + RESEND_COOLDOWN_SEC * 1000 - Date.now()) / 1000));

// Generates a fresh code for a pending signup and emails it. Throws if the email can't be sent.
const issueOtp = async (pending) => {
  const otp = makeOtp();
  const minutes = OTP_MINUTES();
  pending.otpHash = hashOtp(pending.email, otp);
  pending.expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  pending.deleteAt = new Date(pending.expiresAt.getTime() + 30 * 60 * 1000);
  pending.attempts = 0;
  pending.sendCount += 1;
  pending.lastSentAt = new Date();
  await pending.save();
  await sendOtpEmail(pending.email, pending.name, otp, minutes);
};

const otpSentResponse = (res, pending) =>
  res.status(200).json({
    success: true,
    message: `We sent a 6-digit code to ${pending.email}`,
    email: pending.email,
    expiresInMinutes: OTP_MINUTES(),
    resendAfter: RESEND_COOLDOWN_SEC,
  });

const mailFailed = (res, error) => {
  console.log("OTP email failed:", error.message);
  return res.status(502).json({ success: false, message: "Could not send the verification email. Please try again." });
};

// Step 1: validate the form, email a code. The account is NOT created yet.
const signup = async (req, res) => {
  try {
    const { fullname, email, password } = req.body;
    if (!fullname || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }
    if (await User.findOne({ email: cleanEmail })) {
      return res.status(409).json({ success: false, message: "This email is already registered!" });
    }

    let pending = await PendingSignup.findOne({ email: cleanEmail });
    if (pending) {
      const wait = secondsLeft(pending);
      if (wait > 0) {
        return res.status(429).json({
          success: false,
          message: `A code was just sent. Please wait ${wait}s before requesting another.`,
          retryAfter: wait,
        });
      }
      if (pending.sendCount >= MAX_SENDS) {
        return res.status(429).json({ success: false, message: "Too many codes requested. Please try again in a while." });
      }
    } else {
      pending = new PendingSignup({ email: cleanEmail });
    }
    pending.name = String(fullname).trim();
    pending.passwordHash = await bcrypt.hash(String(password), 10);

    try {
      await issueOtp(pending);
    } catch (e) {
      await PendingSignup.deleteOne({ email: cleanEmail });
      return mailFailed(res, e);
    }
    return otpSentResponse(res, pending);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Step 2: check the code, create the user and log them in
const verifyOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    if (!EMAIL_REGEX.test(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: "Enter the 6-digit code" });
    }
    const pending = await PendingSignup.findOne({ email });
    if (!pending) {
      return res.status(400).json({ success: false, message: "Verification expired. Please sign up again." });
    }
    if (pending.attempts >= MAX_ATTEMPTS) {
      await PendingSignup.deleteOne({ email });
      return res.status(429).json({ success: false, message: "Too many wrong attempts. Please sign up again." });
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: "This code has expired. Request a new one." });
    }

    const given = Buffer.from(hashOtp(email, otp));
    const real = Buffer.from(pending.otpHash);
    if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
      pending.attempts += 1;
      await pending.save();
      const left = MAX_ATTEMPTS - pending.attempts;
      if (left <= 0) {
        await PendingSignup.deleteOne({ email });
        return res.status(429).json({ success: false, message: "Too many wrong attempts. Please sign up again." });
      }
      return res.status(400).json({
        success: false,
        message: `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`,
      });
    }

    let user;
    try {
      user = await new User({ name: pending.name, email, password: pending.passwordHash, role: "user" }).save();
    } catch (e) {
      if (e.code === 11000) {
        await PendingSignup.deleteOne({ email });
        return res.status(409).json({ success: false, message: "This email is already registered!" });
      }
      throw e;
    }
    await PendingSignup.deleteOne({ email });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.SECRET_KEY, { expiresIn: "2d" });
    return res.cookie("token", token, cookieOptions).status(201).json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Send a new code for a signup that is waiting for verification
const resendOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const pending = EMAIL_REGEX.test(email) ? await PendingSignup.findOne({ email }) : null;
    if (!pending) {
      return res.status(400).json({ success: false, message: "Verification expired. Please sign up again." });
    }
    const wait = secondsLeft(pending);
    if (wait > 0) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${wait}s before requesting another code.`,
        retryAfter: wait,
      });
    }
    if (pending.sendCount >= MAX_SENDS) {
      return res.status(429).json({ success: false, message: "Too many codes requested. Please sign up again later." });
    }
    try {
      await issueOtp(pending);
    } catch (e) {
      return mailFailed(res, e);
    }
    return otpSentResponse(res, pending);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }
    const found = await User.findOne({ email: String(email).trim().toLowerCase() });
    // Same message for unknown email and wrong password (no user enumeration)
    const ok = found && (await bcrypt.compare(String(password), found.password));
    if (!ok) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    const token = jwt.sign({ id: found._id, role: found.role }, process.env.SECRET_KEY, { expiresIn: "2d" });
    return res
      .cookie("token", token, cookieOptions)
      .status(200)
      .json({ success: true, user: publicUser(found) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const logout = (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite, secure: isProd });
  return res.status(200).json({ success: true, message: "Logged out" });
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const title = String(req.body.title || "").trim();
    if (name.length < 2 || name.length > 40) {
      return res.status(400).json({ success: false, message: "Name must be 2-40 characters" });
    }
    if (title.length > 60) {
      return res.status(400).json({ success: false, message: "Title must be at most 60 characters" });
    }
    const user = await User.findByIdAndUpdate(req.user.id, { name, title }, { returnDocument: "after" });
    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current and new password are required" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }
    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(String(currentPassword), user.password))) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }
    user.password = await bcrypt.hash(String(newPassword), 10);
    await user.save();
    return res.status(200).json({ success: true, message: "Password updated" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports = { signup, verifyOtp, resendOtp, login, logout, me, updateProfile, changePassword };
