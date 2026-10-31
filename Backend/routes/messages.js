const express = require("express");
const { editMessage, deleteMessage, uploadMessage, downloadFile } = require("../controllers/messages");
const { uploadMiddleware } = require("../middleware/upload");
const authenticate = require("../middleware/authenticate");
const router = express.Router();

router.post("/messages/upload", authenticate, uploadMiddleware, uploadMessage);
router.patch("/messages/:id", authenticate, editMessage);
router.delete("/messages/:id", authenticate, deleteMessage);
router.get("/files/:id", authenticate, downloadFile);

module.exports = router;
