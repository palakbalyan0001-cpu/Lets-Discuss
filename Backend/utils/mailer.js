const nodemailer = require("nodemailer");

let transporter;
const mailConfigured = () => !!(process.env.MAIL_USER && process.env.MAIL_PASS);

const getTransporter = () => {
  if (!mailConfigured()) throw new Error("MAIL_USER / MAIL_PASS are not set in .env");
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });
  }
  return transporter;
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = { getTransporter, mailConfigured, escapeHtml };
