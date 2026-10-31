const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ success: false, message: "Please log in first" });
  }
  try {
    req.user = jwt.verify(token, process.env.SECRET_KEY);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Session expired, please log in again" });
  }
};
module.exports = authenticate;
