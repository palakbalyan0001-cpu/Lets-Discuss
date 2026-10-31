const express = require("express");
const { webhook } = require("../controllers/github");
const router = express.Router();

// Called by GitHub (no login cookie) - authenticated with an HMAC signature instead
router.post("/github/:channelId", webhook);

module.exports = router;
