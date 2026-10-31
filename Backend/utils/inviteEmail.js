const { getTransporter, escapeHtml } = require("./mailer");

const inviteEmail = async (email, senderEmail, name, inviteurl) => {
  const safeSender = escapeHtml(senderEmail);
  const safeName = escapeHtml(name);
  await getTransporter().sendMail({
    from: `"Let's Discuss" <${process.env.MAIL_USER}>`,
    replyTo: senderEmail,
    to: email,
    subject: `${senderEmail} invited you to join ${name} on Let's Discuss`,
    text: `Hello,\n\n${senderEmail} has invited you to join the "${name}" workspace on Let's Discuss.\n\nTo accept, open this link in your browser: ${inviteurl}\n\nIf you were not expecting this invitation, you can safely ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #00694c; margin-bottom: 20px;">You've Been Invited to Let's Discuss!</h2>
        <p>Hello,</p>
        <p><strong>${safeSender}</strong> has invited you to collaborate in their <strong>${safeName}</strong> workspace.</p>
        <p style="margin-bottom: 30px;">Let's Discuss is a messaging app where teams can talk and work together in organized channels.</p>
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${inviteurl}" style="background-color: #00694c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Join Workspace</a>
        </div>
        <p style="font-size: 12px; color: #666;">
          <strong>Link not working?</strong> Copy and paste this URL into your browser:<br>
          <a href="${inviteurl}" style="color: #1264A3;">${inviteurl}</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">If you did not expect this invitation, please ignore this email.</p>
      </div>`,
  });
};

module.exports = inviteEmail;
