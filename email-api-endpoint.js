/**
 * XserverVPS側のメール送信APIエンドポイント
 *
 * このエンドポイントはVPS上で動作し、Renderからのメール送信リクエストを受け取り、
 * XserverのSMTPを使用してメールを送信します。
 *
 * セキュリティ: API_KEYによる認証が必要
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

// APIキー検証ミドルウェア
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.XSERVER_API_KEY;

  if (!validApiKey) {
    logger.error('XSERVER_API_KEY not configured');
    return res.status(500).json({
      success: false,
      error: 'API key not configured on server'
    });
  }

  if (!apiKey) {
    logger.warn('API request without key', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }

  if (apiKey !== validApiKey) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      path: req.path
    });
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  next();
}

// メール送信エンドポイント
async function sendEmailHandler(req, res) {
  try {
    const { from, to, replyTo, subject, html, text } = req.body;

    // バリデーション
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, and html/text'
      });
    }

    logger.info('Email API request received', {
      to,
      subject,
      from: from || process.env.FROM_EMAIL,
      ip: req.ip
    });

    // Nodemailer設定（XserverSMTP使用）
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'sv10210.xserver.jp',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'collection@kanucard.com',
        pass: process.env.SMTP_PASS
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      logger: process.env.NODE_ENV !== 'production',
      debug: process.env.NODE_ENV !== 'production'
    });

    // メール送信オプション
    const mailOptions = {
      from: from || process.env.FROM_EMAIL || 'collection@kanucard.com',
      to,
      replyTo: replyTo || undefined,
      subject,
      html,
      text
    };

    // メール送信実行
    const info = await transporter.sendMail(mailOptions);

    logger.info('Email sent successfully via API', {
      to,
      subject,
      messageId: info.messageId,
      response: info.response
    });

    res.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });

  } catch (error) {
    logger.error('Email API send error', {
      error: error.message,
      stack: error.stack,
      to: req.body.to,
      subject: req.body.subject
    });

    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
}

module.exports = {
  validateApiKey,
  sendEmailHandler
};
