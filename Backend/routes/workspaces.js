const express = require("express");
const ctrl = require("../controllers/workspaces");
const { createOrGetDm } = require("../controllers/dms");
const authenticate = require("../middleware/authenticate");
const router = express.Router();

router.use(authenticate);
router.post("/create", ctrl.createWorkspaces);
router.get("/", ctrl.getMyWorkspaces);
// invite routes must come before "/:id"
router.get("/invite/:code", ctrl.inviteInfo);
router.post("/join/:code", ctrl.joinWorkspace);
router.get("/:id", ctrl.getWorkspace);
router.delete("/:id", ctrl.deleteWorkspace);
router.post("/:id/leave", ctrl.leaveWorkspace);
router.post("/:id/invite", ctrl.inviteMembers);
router.post("/:id/channels", ctrl.createChannel);
router.post("/:id/dms", createOrGetDm);
router.patch("/:id/members/:userId", ctrl.setMemberRole);
router.delete("/:id/members/:userId", ctrl.removeMember);

module.exports = router;
