const express = require("express");
const { search } = require("../controllers/search");
const authenticate = require("../middleware/authenticate");
const router = express.Router();

router.get("/", authenticate, search);

module.exports = router;
