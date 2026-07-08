import nodemailer from 'nodemailer';

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;
  
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    return transporter;
  } catch (err) {
    console.error('SMTP Init Error:', err);
    throw err;
  }
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { email, code, name } = req.body;

    if (!email || !code || !name) {
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }

    const mailTransporter = await getTransporter();

    const mailOptions = {
      from: '"Devil AI Support" <support@devil.ai>',
      to: email,
      subject: `[Devil Chatbot] Confirm Your Account - Code: ${code}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 550px; margin: 20px auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff; color: #18181b;">
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f4f4f5;">
            <h1 style="color: #ef4444; font-size: 26px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">Devil Chatbot</h1>
            <p style="color: #71717a; margin: 4px 0 0 0; font-size: 13px;">Security Verification Code</p>
          </div>
          <div style="font-size: 15px; line-height: 1.6;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>We received a registration request for this email address. To complete your sign-up and unlock vision analysis and image drawing features, please enter the following 6-digit verification code:</p>
            
            <div style="text-align: center; margin: 32px 0; background-color: #f4f4f5; padding: 18px; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #09090b; border: 1px solid #e4e4e7;">
              ${code}
            </div>
            
            <p style="font-size: 12px; color: #71717a; margin-top: 24px;">This code is temporary and will expire in 10 minutes. If you did not make this request, you can safely ignore this mail.</p>
          </div>
        </div>
      `
    };

    const info = await mailTransporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    res.status(200).json({ success: true, previewUrl });

  } catch (err) {
    console.error('SMTP handler error:', err);
    res.status(500).json({ error: 'Mail dispatch failed', details: err.message });
  }
}
