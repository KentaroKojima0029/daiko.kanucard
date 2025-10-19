/**
 * VPS側メール送信APIサーバー
 *
 * このファイルをXserver VPS (https://api.kanucard.com) にデプロイしてください。
 *
 * 使用方法:
 * 1. このファイルをVPSにアップロード
 * 2. npm install express nodemailer を実行
 * 3. .env ファイルを作成（下記参照）
 * 4. node vps-email-api.js でサーバー起動
 * 5. PM2やforeverで常駐化推奨
 */

const express = require('express');
const nodemailer = require('nodemailer');

// 環境変数の読み込み
require('dotenv').config();

const app = express();
const PORT = process.env.EMAIL_API_PORT || 3001;

// ミドルウェア
app.use(express.json());

// CORS設定（Render.comからのアクセスを許可）
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ロギング
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Nodemailer transporter設定
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'sv10210.xserver.jp',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'contact@kanucard.com',
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  },
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000
});

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'VPS Email API',
    timestamp: new Date().toISOString()
  });
});

// メール送信エンドポイント
app.post('/api/send-email', async (req, res) => {
  try {
    const { from, to, replyTo, subject, html, text } = req.body;

    console.log('[Email API] Request received:', {
      to,
      subject,
      from: from || process.env.FROM_EMAIL,
      timestamp: new Date().toISOString()
    });

    // バリデーション
    if (!to || !subject || (!html && !text)) {
      console.error('[Email API] Validation error: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, and html/text'
      });
    }

    // メール送信オプション
    const mailOptions = {
      from: from || process.env.FROM_EMAIL || 'contact@kanucard.com',
      to,
      replyTo: replyTo || undefined,
      subject,
      html,
      text
    };

    // メール送信実行
    console.log('[Email API] Sending email via SMTP...');
    const info = await transporter.sendMail(mailOptions);

    console.log('[Email API] ✓ Email sent successfully:', {
      to,
      messageId: info.messageId,
      response: info.response
    });

    res.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('[Email API] ✗ Error sending email:', {
      error: error.message,
      to: req.body.to,
      subject: req.body.subject,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: process.env.NODE_ENV !== 'production' ? error.message : 'Internal server error'
    });
  }
});

// 404エラーハンドラ
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// グローバルエラーハンドラ
app.use((err, req, res, next) => {
  console.error('[Email API] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('✓ VPS Email API Server Started');
  console.log(`Port: ${PORT}`);
  console.log(`SMTP Host: ${process.env.SMTP_HOST || 'sv10210.xserver.jp'}`);
  console.log(`SMTP User: ${process.env.SMTP_USER || 'contact@kanucard.com'}`);
  console.log(`FROM Email: ${process.env.FROM_EMAIL || 'contact@kanucard.com'}`);
  console.log('========================================');
  console.log('Endpoints:');
  console.log(`  GET  /api/health       - Health check`);
  console.log(`  POST /api/send-email   - Send email`);
  console.log('========================================');
});
