const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { UPLOAD_DIR } = require("../utils/messages");

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
// Whitelist: mimetype -> extension we store with (the user's own extension is never trusted). No SVG/HTML (XSS).
const ALLOWED = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/zip": ".zip",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex") + ALLOWED[file.mimetype]),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new Error("This file type is not allowed"));
    cb(null, true);
  },
}).single("file");

// Check the real file signature so a renamed .exe can't pose as a PNG/PDF
const SIGNATURES = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  "application/zip": [[0x50, 0x4b]],
};
const hasValidSignature = (filePath, mimetype) => {
  const sigs = SIGNATURES[mimetype] || (mimetype.includes("openxmlformats") ? SIGNATURES["application/zip"] : null);
  if (!sigs) return true; // text/csv/legacy office: no reliable signature
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  return sigs.some((sig) => sig.every((b, i) => buf[i] === b));
};

const uploadMiddleware = (req, res, next) =>
  upload(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 10 MB)" : err.message || "Upload failed";
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ success: false, message: msg });
  });

module.exports = { uploadMiddleware, hasValidSignature, MAX_SIZE, path };
