const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const sendAccountNotification = async (user, { subject, heading, message, details = [] }) => {
  if (!user?.email) {
    console.error(`Could not send "${subject}" email: user email is missing.`);
    return false;
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error(`Could not send "${subject}" email: EMAIL_USER and EMAIL_PASS are not configured.`);
    return false;
  }

  const rows = details.map(({ label, value }) => `
    <tr>
      <td style="padding: 8px 12px; color: #94A3B8;">${escapeHtml(label)}</td>
      <td style="padding: 8px 12px; color: #E2E8F0; text-align: right;">${escapeHtml(value)}</td>
    </tr>
  `).join('');
  const firstName = escapeHtml(user.firstName || 'Investor');

  try {
    await transporter.sendMail({
      from: `"VicBits Capitals" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      text: `${heading}\n\nHello ${user.firstName || 'Investor'},\n\n${message}${details.map(({ label, value }) => `\n${label}: ${value}`).join('')}\n\nIf you have questions, please contact VicBits Capitals Support.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #040C18; color: #E2E8F0; border: 1px solid #1E293B; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #F3B233; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">VICBITS CAPITALS</h1>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 4px;">SECURE INVESTOR VAULT</p>
          </div>
          <h2 style="color: #FFFFFF; font-size: 18px; margin-bottom: 12px;">${escapeHtml(heading)}</h2>
          <p style="color: #CBD5E1; font-size: 14px;">Hello ${firstName},</p>
          <p style="color: #94A3B8; font-size: 14px; line-height: 1.6;">${escapeHtml(message)}</p>
          ${rows ? `<table style="width: 100%; margin: 20px 0; border-collapse: collapse; background: #081528; border: 1px solid #1E293B;">${rows}</table>` : ''}
          <p style="color: #64748B; font-size: 12px;">If you have questions, please contact VicBits Capitals Support.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error(`Could not send "${subject}" email to ${user.email}:`, error);
    return false;
  }
};

module.exports = { sendAccountNotification, transporter };
