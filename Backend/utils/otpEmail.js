const { getTransporter, mailConfigured, escapeHtml } = require("./mailer");

// Sends the 6-digit verification code. Without MAIL_USER / MAIL_PASS (local development only)
// the code is printed in the server console instead, so you can still sign up while testing.
const sendOtpEmail = async (email, name, otp, minutes) => {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Mail is not configured");
    console.log(`[DEV] Mail not configured - verification code for ${email}: ${otp}`);
    return;
  }
  const safeName = escapeHtml(name);
  await getTransporter().sendMail({
    from: `"Let's Discuss" <${process.env.MAIL_USER}>`,
    to: email,
    subject: `${otp} is your Let's Discuss verification code`,
    text: `Hi ${name},\n\nYour Let's Discuss verification code is ${otp}.\n\nIt expires in ${minutes} minutes. If you didn't try to sign up, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #00694c; margin: 0 0 16px;">Verify your email</h2>
        <p>Hi ${safeName},</p>
        <p>Use this code to finish creating your Let's Discuss account:</p>
        <p style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 32px; letter-spacing: 10px; font-weight: bold; background: #f0faf6; color: #00694c; padding: 12px 20px 12px 30px; border-radius: 8px;">${otp}</span>
        </p>
        <p style="font-size: 13px; color: #666;">This code expires in ${minutes} minutes. Never share it with anyone.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">If you didn't try to sign up, you can safely ignore this email.</p>
      </div>`,
  });
};

module.exports = sendOtpEmail;
