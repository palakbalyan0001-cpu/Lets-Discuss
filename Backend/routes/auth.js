const express = require("express");
const rateLimit = require("express-rate-limit");
const { signup, verifyOtp, resendOtp, login, logout, me, updateProfile, changePassword } = require("../controllers/authcontroller");
const authenticate = require("../middleware/authenticate");
const router = express.Router();

// slow down password guessing / signup spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { success: false, message: "Too many attempts, try again later" },
});

router.post("/signup", limiter, signup);
router.post("/verify-otp", limiter, verifyOtp);
router.post("/resend-otp", limiter, resendOtp);
router.post("/login", limiter, login);
router.post("/logout", logout);
router.get("/me", authenticate, me);
router.patch("/profile", authenticate, updateProfile);
router.patch("/password", authenticate, limiter, changePassword);

module.exports = router;
