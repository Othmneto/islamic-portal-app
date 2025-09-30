const nodemailer = require('nodemailer');
const { env } = require('../config');

/**
 * Send email using nodemailer
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 */
const sendEmail = async (options) => {
  try {
    console.log('📧 sendEmail called with options:', {
      to: options.to || options.email,
      subject: options.subject,
      hasHtml: !!options.html
    });
    
    // Create transporter based on environment
    let transporter;
    
    if (env.NODE_ENV === 'production') {
      console.log('📧 Using production email configuration');
      // Production email service (e.g., SendGrid, Mailgun, etc.)
      transporter = nodemailer.createTransport({
        host: env.EMAIL_HOST,
        port: env.EMAIL_PORT || 587,
        secure: env.EMAIL_SECURE === 'true',
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS,
        },
      });
    } else {
      // Check if Gmail App Password is configured in environment
      const gmailAppPassword = env.EMAIL_PASS;
      
      if (!gmailAppPassword || gmailAppPassword === 'YOUR_ACTUAL_APP_PASSWORD_HERE') {
        console.log('📧 Gmail App Password not configured, using console mode for development');
        // Development - use console logging for testing
        transporter = {
          sendMail: async (mailOptions) => {
            console.log('📧 [DEV EMAIL] ===========================================');
            console.log('📧 [DEV EMAIL] TO:', mailOptions.to);
            console.log('📧 [DEV EMAIL] SUBJECT:', mailOptions.subject);
            console.log('📧 [DEV EMAIL] HTML CONTENT:');
            console.log(mailOptions.html);
            console.log('📧 [DEV EMAIL] ===========================================');
            return { messageId: 'dev-' + Date.now() };
          }
        };
      } else {
        console.log('📧 Using Gmail SMTP with environment variables');
        // Development - use Gmail SMTP to send real emails
        transporter = nodemailer.createTransport({
          host: env.EMAIL_HOST || 'smtp.gmail.com',
          port: env.EMAIL_PORT || 587,
          secure: env.EMAIL_SECURE === 'true',
          auth: {
            user: env.EMAIL_USER || 'ahmedothmanofff@gmail.com',
            pass: gmailAppPassword
          },
          tls: {
            rejectUnauthorized: false
          }
        });
      }
    }
    
    console.log('📧 Transporter created with config:', {
      host: transporter.options?.host || 'development-mode',
      port: transporter.options?.port || 'N/A',
      secure: transporter.options?.secure || 'N/A',
      hasAuth: !!transporter.options?.auth?.user
    });

    // Email options
    const mailOptions = {
      from: env.EMAIL_FROM || 'Translator App <noreply@translator-app.com>',
      to: options.to || options.email,
      subject: options.subject,
      html: options.html,
    };

    console.log('📧 Mail options prepared:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      htmlLength: mailOptions.html.length
    });

    // Send email
    console.log('📧 Attempting to send email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending email:', {
      message: error.message,
      code: error.code,
      response: error.response,
      stack: error.stack
    });
    throw error;
  }
};

module.exports = sendEmail;
