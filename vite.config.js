import { defineConfig } from 'vite';
import nodemailer from 'nodemailer';

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;
  
  try {
    // Generate mock SMTP account for test delivery logs
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
    console.log(`\x1b[32m[SMTP] Ethereal SMTP service ready: ${testAccount.user}\x1b[0m`);
    return transporter;
  } catch (err) {
    console.error('\x1b[31m[SMTP] Error initializing Ethereal account:\x1b[0m', err);
    throw err;
  }
}

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    host: '127.0.0.1'
  },
  plugins: [
    {
      name: 'api-verification-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Intercept verification email POST
          if (req.url === '/api/send-verification' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body);
                const { email, code, name } = parsed;

                if (!email || !code || !name) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Missing parameters' }));
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

                console.log(`\x1b[32m[SMTP] Email sent successfully to ${email}\x1b[0m`);
                console.log(`\x1b[34m[SMTP] Preview URL: ${previewUrl}\x1b[0m`);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, previewUrl }));

              } catch (err) {
                console.error('[SMTP] Send mail error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Internal mail dispatch failed', details: err.message }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ]
});
