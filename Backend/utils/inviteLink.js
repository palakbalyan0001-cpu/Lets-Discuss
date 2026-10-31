const crypto = require("crypto");
const generateLink = async () => crypto.randomBytes(10).toString("hex");
module.exports = generateLink;
