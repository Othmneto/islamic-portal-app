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
      console.log('📧 Using development email configuration');
      // Development - use Mailtrap or similar test service
      transporter = nodemailer.createTransport({
        host: env.EMAIL_HOST || 'smtp.mailtrap.io',
        port: env.EMAIL_PORT || 2525,
        auth: {
          user: env.EMAIL_USER || 'your-mailtrap-user',
          pass: env.EMAIL_PASS || 'your-mailtrap-pass',
        },
      });
    }
    
    console.log('📧 Transporter created with config:', {
      host: transporter.options.host,
      port: transporter.options.port,
      secure: transporter.options.secure,
      hasAuth: !!transporter.options.auth.user
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
