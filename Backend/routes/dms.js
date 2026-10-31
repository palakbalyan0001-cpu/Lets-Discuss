const express = require("express");
const { listMessages, markRead } = require("../controllers/messages");
const authenticate = require("../middleware/authenticate");
const router = express.Router();

router.use(authenticate);
router.get("/:id/messages", listMessages("dm"));
router.post("/:id/read", markRead("dm"));

module.exports = router;
