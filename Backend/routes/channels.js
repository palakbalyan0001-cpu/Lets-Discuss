const express = require("express");
const { listMessages, markRead } = require("../controllers/messages");
const { joinChannel, leaveChannel, deleteChannel } = require("../controllers/channels");
const github = require("../controllers/github");
const authenticate = require("../middleware/authenticate");
const router = express.Router();

router.use(authenticate);
router.get("/:id/messages", listMessages("channel"));
router.post("/:id/read", markRead("channel"));
router.post("/:id/join", joinChannel);
router.post("/:id/leave", leaveChannel);
router.delete("/:id", deleteChannel);
router.get("/:id/github", github.getGithubInfo);
router.put("/:id/github", github.linkRepo);
router.delete("/:id/github", github.unlinkRepo);
router.get("/:id/github/webhook", github.getWebhookInfo);

module.exports = router;
