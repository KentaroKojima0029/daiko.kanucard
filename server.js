const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { init: initDatabase, submissionQueries, kaitoriQueries } = require('./database');
const { getCustomerById, getCustomerOrders, listAllCustomers } = require('./shopify-client');
const logger = require('./logger');
const {
  apiLimiter,
  authLimiter,
  verifyLimiter,
  validatePhoneNumber,
  validateVerificationCode,
  validateEmail,
  validateName,
  handleValidationErrors,
  securityHeaders,
  notFoundHandler,
  errorHandler,
  requestLogger
} = require('./middleware');
const {
  testShopifyConnection,
  testDatabaseConnection,
  healthCheck
} = require('./shopify-test');

const app = express();
const port = process.env.PORT || 3000;

// Render/プロキシ環境対応
app.set('trust proxy', 1);

// データベース初期化
initDatabase();

// セキュリティヘッダーとロギング（最優先）
app.use(securityHeaders);
app.use(requestLogger);

// CORS設定（外部管理画面用）
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://new-daiko-form.onrender.com',
    'http://localhost:3000',
    'http://localhost:3443',
    'https://kanucard.com',
    'https://www.kanucard.com',
    'http://kanucard.com',
    'http://www.kanucard.com',
    process.env.ADMIN_ORIGIN // Xserverのドメインを環境変数で設定可能
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Auth');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

logger.info('Server initializing', {
  nodeEnv: process.env.NODE_ENV,
  port
});

// 静的ファイルの配信（優先）
app.use(express.static(__dirname, {
  maxAge: '1d',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Nodemailer設定
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'sv10210.xserver.jp',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'collection@kanucard.com',
    pass: process.env.SMTP_PASS
  }
});

// リッチフォーム送信API
app.post('/api/rich-form-submit', async (req, res) => {
  try {
    const {
      contactName,
      contactEmail,
      contactBody,
      plan,
      serviceOption,
      purchaseOffer,
      returnMethod,
      inspectionOption,
      items,
      totalQuantity,
      totalDeclaredValue,
      totalAcquisitionValue,
      totalFee,
      estimatedTax,
      estimatedGradingFee,
      totalEstimatedFee
    } = req.body;

    // バリデーション
    if (!contactName || !contactEmail || !items || items.length === 0) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    // カード情報のHTML生成
    const cardsHtml = items.map((item, index) => `
      <div style="border: 2px solid #e5e7eb; padding: 16px; margin-bottom: 12px; border-radius: 8px; background: #f8fafc;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #4f46e5;">No. ${index + 1}</p>
        <p style="margin: 0 0 4px 0; font-size: 14px;"><strong>カード名:</strong> ${item.itemName}</p>
        <p style="margin: 0 0 4px 0; font-size: 14px;"><strong>数量:</strong> ${item.quantity}枚</p>
        <p style="margin: 0 0 4px 0; font-size: 14px;">
          <strong>1枚の申告額:</strong> ¥${Number(item.declaredValue).toLocaleString()}
          <span style="margin-left: 16px; color: #059669;">
            <strong>合計申告額:</strong> ¥${Number(item.declaredValue * item.quantity).toLocaleString()}
          </span>
        </p>
        <p style="margin: 0; font-size: 14px;">
          <strong>取得額:</strong> ${item.acquisitionValue ? '¥' + Number(item.acquisitionValue).toLocaleString() : '未設定'}
        </p>
      </div>
    `).join('');

    // 顧客向けメール
    const customerMailOptions = {
      from: process.env.FROM_EMAIL || 'collection@kanucard.com',
      to: contactEmail,
      subject: 'PSA代行サービス - お申し込みありがとうございます',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 3px solid #4f46e5; padding-bottom: 10px;">
            PSA代行サービス お申し込み受付完了
          </h2>

          <p style="font-size: 16px; color: #555;">
            ${contactName} 様
          </p>

          <p style="font-size: 14px; line-height: 1.6; color: #666;">
            この度はPSA代行サービスをご利用いただき、誠にありがとうございます。<br>
            以下の内容で代行依頼を受け付けました。
          </p>

          <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 20px; border-radius: 12px; margin: 24px 0;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px;">💰 お支払いについて</h3>

            <div style="background: rgba(255, 255, 255, 0.15); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #fff;">1回目のお支払い（サービス開始時）</h4>
              <table style="width: 100%; color: white;">
                <tr>
                  <td style="padding: 8px 0;">代行手数料</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 16px;">${totalFee}</td>
                </tr>
                <tr style="border-top: 2px solid rgba(255,255,255,0.4);">
                  <td style="padding: 8px 0; font-weight: bold;">小計</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px;">${totalFee}</td>
                </tr>
              </table>
            </div>

            <div style="background: rgba(255, 255, 255, 0.15); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #fff;">2回目のお支払い（カード受取時）</h4>
              <table style="width: 100%; color: white;">
                <tr>
                  <td style="padding: 8px 0;">鑑定料</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${estimatedGradingFee}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">輸出入送料</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">実費精算</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">関税（発生時のみ）</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${estimatedTax}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">その他諸費用</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">実費精算</td>
                </tr>
                <tr style="border-top: 2px solid rgba(255,255,255,0.4);">
                  <td style="padding: 8px 0; font-weight: bold;">小計（見込）</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px;">${estimatedGradingFee} +実費</td>
                </tr>
              </table>
            </div>

            <div style="background: rgba(255, 255, 255, 0.25); padding: 16px; border-radius: 8px;">
              <table style="width: 100%; color: white;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; font-size: 18px;">総額（見込）</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 20px;">${totalEstimatedFee}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; color: rgba(255, 255, 255, 0.9); margin: 12px 0 0 0; line-height: 1.6;">
              ※ 2回目のお支払いは実際の費用確定後にご請求いたします。<br>
              ※ 関税は発生しない場合もございます。
            </p>
          </div>

          <h3 style="color: #333; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
            基本情報
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; background: #f8fafc; font-weight: bold; width: 35%;">お名前</td>
              <td style="padding: 8px; background: #fff;">${contactName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f8fafc; font-weight: bold;">メールアドレス</td>
              <td style="padding: 8px; background: #fff;">${contactEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f8fafc; font-weight: bold;">PSAプラン</td>
              <td style="padding: 8px; background: #fff;">${serviceOption}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f8fafc; font-weight: bold;">代行プラン</td>
              <td style="padding: 8px; background: #fff;">${plan}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f8fafc; font-weight: bold;">買取額提示</td>
              <td style="padding: 8px; background: #fff;">${purchaseOffer}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f8fafc; font-weight: bold;">返却方法</td>
              <td style="padding: 8px; background: #fff;">${returnMethod}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f8fafc; font-weight: bold;">無料検品</td>
              <td style="padding: 8px; background: #fff;">${inspectionOption}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f8fafc; font-weight: bold;">カード枚数</td>
              <td style="padding: 8px; background: #fff;">${totalQuantity}</td>
            </tr>
          </table>

          ${contactBody ? `
          <h3 style="color: #333; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
            メッセージ
          </h3>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${contactBody}</p>
          </div>
          ` : ''}

          <h3 style="color: #333; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
            カード情報
          </h3>
          ${cardsHtml}

          <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">
              <strong>次のステップ：</strong><br>
              • 担当者が内容を確認後、1-2営業日以内にご連絡いたします<br>
              • ご不明な点がございましたら、このメールに返信してください
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              © 2025 PSA代行サービス. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    // 管理者向けメール
    const adminMailOptions = {
      from: process.env.FROM_EMAIL || 'collection@kanucard.com',
      to: process.env.ADMIN_EMAIL || 'contact@kanucard.com',
      replyTo: contactEmail,
      subject: `【新規申込】PSA代行サービス - ${contactName}様`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 20px; border-radius: 12px; margin: 0 0 20px 0;">
            🎯 新規PSA代行申込
          </h2>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #856404; font-weight: bold;">
              ⚠️ 新しい代行申込が届きました - 早急な対応をお願いします
            </p>
          </div>

          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 12px; margin: 24px 0;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px;">料金情報</h3>
            <table style="width: 100%; color: white;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">申告額合計</td>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2); text-align: right; font-weight: bold;">¥${Number(totalDeclaredValue).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">取得額合計</td>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2); text-align: right; font-weight: bold;">¥${Number(totalAcquisitionValue).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">代行手数料</td>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2); text-align: right; font-weight: bold;">${totalFee}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">見込鑑定料</td>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2); text-align: right; font-weight: bold;">${estimatedGradingFee}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">関税見込み</td>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2); text-align: right; font-weight: bold;">${estimatedTax}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0 8px 0; font-size: 16px; font-weight: bold;">支払総額（予定）</td>
                <td style="padding: 12px 0 8px 0; text-align: right; font-size: 18px; font-weight: bold;">${totalEstimatedFee}</td>
              </tr>
            </table>
          </div>

          <h3 style="color: #333; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
            顧客情報
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: white; border: 1px solid #e5e7eb;">
            <tr>
              <td style="padding: 12px; background: #f8fafc; font-weight: bold; width: 30%; border: 1px solid #e5e7eb;">お名前</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">${contactName}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background: #f8fafc; font-weight: bold; border: 1px solid #e5e7eb;">メール</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;"><a href="mailto:${contactEmail}">${contactEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px; background: #f8fafc; font-weight: bold; border: 1px solid #e5e7eb;">PSAプラン</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">${serviceOption}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background: #f8fafc; font-weight: bold; border: 1px solid #e5e7eb;">代行プラン</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">${plan}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background: #f8fafc; font-weight: bold; border: 1px solid #e5e7eb;">買取額提示</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">${purchaseOffer}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background: #f8fafc; font-weight: bold; border: 1px solid #e5e7eb;">返却方法</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">${returnMethod}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background: #f8fafc; font-weight: bold; border: 1px solid #e5e7eb;">無料検品</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">${inspectionOption}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background: #f8fafc; font-weight: bold; border: 1px solid #e5e7eb;">カード枚数</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">${totalQuantity}</td>
            </tr>
          </table>

          ${contactBody ? `
          <h3 style="color: #333; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
            顧客メッセージ
          </h3>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 2px solid #e5e7eb; margin: 16px 0;">
            <p style="margin: 0; white-space: pre-wrap; font-size: 14px;">${contactBody}</p>
          </div>
          ` : ''}

          <h3 style="color: #333; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
            カード情報詳細
          </h3>
          ${cardsHtml}

          <div style="text-align: center; margin: 30px 0;">
            <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">
              申込日時: ${new Date().toLocaleString('ja-JP')}
            </p>
          </div>
        </div>
      `
    };

    // メール送信
    await transporter.sendMail(customerMailOptions);
    await transporter.sendMail(adminMailOptions);

    res.json({
      success: true,
      message: 'お申し込みありがとうございました。確認メールをお送りしました。'
    });

  } catch (error) {
    console.error('メール送信エラー:', error);
    res.status(500).json({
      error: 'メール送信に失敗しました。もう一度お試しください。'
    });
  }
});

// お問い合わせAPI
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    // 管理者向けメール
    const adminMailOptions = {
      from: process.env.FROM_EMAIL || 'collection@kanucard.com',
      to: process.env.ADMIN_EMAIL || 'contact@kanucard.com',
      subject: `[お問い合わせ] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 3px solid #4f46e5; padding-bottom: 10px;">
            新規お問い合わせ
          </h2>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 12px 0;"><strong>お名前:</strong> ${name}</p>
            <p style="margin: 0 0 12px 0;"><strong>メールアドレス:</strong> ${email}</p>
            <p style="margin: 0 0 12px 0;"><strong>件名:</strong> ${subject}</p>
          </div>

          <div style="background: white; padding: 20px; border: 2px solid #e5e7eb; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; font-weight: bold;">お問い合わせ内容:</p>
            <p style="margin: 0; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
        </div>
      `
    };

    // お客様向け自動返信メール
    const customerMailOptions = {
      from: process.env.FROM_EMAIL || 'collection@kanucard.com',
      to: email,
      subject: `お問い合わせを受け付けました - ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 3px solid #4f46e5; padding-bottom: 10px;">
            お問い合わせありがとうございます
          </h2>

          <p style="font-size: 16px; color: #555;">
            ${name} 様
          </p>

          <p style="font-size: 14px; line-height: 1.6; color: #666;">
            この度はPSA代行サービスにお問い合わせいただき、誠にありがとうございます。<br>
            以下の内容でお問い合わせを受け付けました。
          </p>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 12px 0;"><strong>件名:</strong> ${subject}</p>
            <p style="margin: 0 0 8px 0; font-weight: bold;">お問い合わせ内容:</p>
            <p style="margin: 0; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #666;">
            担当者が内容を確認次第、ご返信させていただきます。<br>
            通常24時間以内にご返信しておりますので、しばらくお待ちください。
          </p>

          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              ※ このメールは自動送信されています。<br>
              ご返信いただいても対応できかねますので、ご了承ください。
            </p>
          </div>

          <p style="font-size: 14px; color: #999; margin-top: 32px; text-align: center;">
            PSA代行サービス<br>
            collection@kanucard.com
          </p>
        </div>
      `
    };

    // メール送信
    await transporter.sendMail(adminMailOptions);
    await transporter.sendMail(customerMailOptions);

    res.json({
      success: true,
      message: 'お問い合わせを受け付けました'
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      error: 'メール送信に失敗しました。もう一度お試しください。'
    });
  }
});

// ===== テスト/ヘルスチェックAPI =====

// ヘルスチェック
app.get('/api/health', async (req, res) => {
  try {
    const health = await healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Shopify接続テスト
app.get('/api/test/shopify', async (req, res) => {
  try {
    const results = await testShopifyConnection();
    logger.info('Shopify connection test completed', { overall: results.overall });
    res.json(results);
  } catch (error) {
    logger.error('Shopify test error', { error: error.message });
    res.status(500).json({
      error: 'テストの実行に失敗しました',
      details: error.message
    });
  }
});

// データベーステスト
app.get('/api/test/database', async (req, res) => {
  try {
    const results = await testDatabaseConnection();
    logger.info('Database test completed', { overall: results.overall });
    res.json(results);
  } catch (error) {
    logger.error('Database test error', { error: error.message });
    res.status(500).json({
      error: 'テストの実行に失敗しました',
      details: error.message
    });
  }
});

// Shopify顧客リスト取得（デバッグ用）
app.get('/api/debug/customers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const results = await listAllCustomers(limit);

    logger.info('Customer list retrieved', {
      count: results.count,
      success: results.success
    });

    res.json(results);
  } catch (error) {
    logger.error('List customers error', { error: error.message });
    res.status(500).json({
      success: false,
      error: '顧客リストの取得に失敗しました',
      details: error.message
    });
  }
});

// メールアドレスで顧客を検索（デバッグ用）
app.get('/api/debug/search-email', async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'emailパラメータが必要です'
      });
    }

    console.log('[DEBUG API] Searching for email:', email);

    const { findCustomerByEmail } = require('./shopify-client');
    const customer = await findCustomerByEmail(email);

    console.log('[DEBUG API] Search result:', {
      found: !!customer,
      email: customer?.email || 'N/A'
    });

    res.json({
      success: true,
      email: email,
      found: !!customer,
      customer: customer || null
    });
  } catch (error) {
    console.error('[DEBUG API] Search error:', error);
    logger.error('Email search error', { error: error.message });
    res.status(500).json({
      success: false,
      error: '検索に失敗しました',
      details: error.message
    });
  }
});

// ===== 買取管理API =====

// 買取依頼作成
app.post('/api/kaitori/create', async (req, res) => {
  try {
    const {
      cardName,
      cardCondition,
      cardImageUrl,
      customerName,
      customerEmail,
      customerPhone,
      assessmentPrice,
      assessmentComment,
      assessorName
    } = req.body;

    // バリデーション
    if (!cardName || !customerName || !customerEmail) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    // トークン生成
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // 有効期限（30日後）
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    // DB登録
    const result = kaitoriQueries.create.run(
      token,
      cardName,
      cardCondition || null,
      cardImageUrl || null,
      customerName,
      customerEmail,
      customerPhone || null,
      validUntil.toISOString()
    );

    // 査定情報がある場合は更新
    if (assessmentPrice) {
      kaitoriQueries.updateAssessment.run(
        assessmentPrice,
        assessmentComment || null,
        assessorName || null,
        new Date().toISOString(),
        result.lastInsertRowid
      );
    }

    // 承認URL生成
    const approvalUrl = `${req.protocol}://${req.get('host')}/kaitori/approval?id=${token}`;

    logger.info('Kaitori request created', {
      id: result.lastInsertRowid,
      cardName,
      customerEmail
    });

    res.json({
      success: true,
      message: '買取依頼を作成しました',
      id: result.lastInsertRowid,
      token,
      approvalUrl
    });
  } catch (error) {
    console.error('Kaitori create error:', error);
    logger.error('Kaitori create error', { error: error.message });
    res.status(500).json({ error: '作成に失敗しました' });
  }
});

// 買取依頼一覧取得
app.get('/api/kaitori/list', async (req, res) => {
  try {
    const requests = kaitoriQueries.findAll.all();
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Kaitori list error:', error);
    logger.error('Kaitori list error', { error: error.message });
    res.status(500).json({ error: 'データの取得に失敗しました' });
  }
});

// 買取依頼詳細取得（ID）
app.get('/api/kaitori/detail/:id', async (req, res) => {
  try {
    const request = kaitoriQueries.findById.get(req.params.id);
    if (!request) {
      return res.status(404).json({ error: '依頼が見つかりません' });
    }
    res.json({ success: true, request });
  } catch (error) {
    console.error('Kaitori detail error:', error);
    logger.error('Kaitori detail error', { error: error.message });
    res.status(500).json({ error: 'データの取得に失敗しました' });
  }
});

// 買取依頼詳細取得（トークン）
app.get('/api/kaitori/request/:token', async (req, res) => {
  try {
    const request = kaitoriQueries.findByToken.get(req.params.token);
    if (!request) {
      return res.status(404).json({ error: '依頼が見つかりません' });
    }

    // 有効期限チェック
    if (new Date(request.valid_until) < new Date()) {
      return res.status(400).json({ error: 'この依頼は有効期限切れです' });
    }

    res.json(request);
  } catch (error) {
    console.error('Kaitori request error:', error);
    logger.error('Kaitori request error', { error: error.message });
    res.status(500).json({ error: 'データの取得に失敗しました' });
  }
});

// 買取承認/拒否
app.post('/api/kaitori/respond', async (req, res) => {
  try {
    const { token, responseType, bankInfo } = req.body;

    if (!token || !responseType) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    // 依頼取得
    const request = kaitoriQueries.findByToken.get(token);
    if (!request) {
      return res.status(404).json({ error: '依頼が見つかりません' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'この依頼は既に回答済みです' });
    }

    // ステータス更新
    kaitoriQueries.updateResponse.run(
      responseType === 'approved' ? 'approved' : 'rejected',
      responseType,
      new Date().toISOString(),
      token
    );

    // 承認の場合は振込先情報も更新
    if (responseType === 'approved' && bankInfo) {
      kaitoriQueries.updateBankInfo.run(
        bankInfo.bankName,
        bankInfo.bankBranch,
        bankInfo.accountNumber,
        bankInfo.accountHolder,
        token
      );
    }

    logger.info('Kaitori response received', {
      token,
      responseType,
      customerEmail: request.customer_email
    });

    // TODO: 管理者へメール通知

    res.json({
      success: true,
      message: responseType === 'approved' ? '承認しました' : '拒否しました'
    });
  } catch (error) {
    console.error('Kaitori respond error:', error);
    logger.error('Kaitori respond error', { error: error.message });
    res.status(500).json({ error: '送信に失敗しました' });
  }
});

// ===== HTMLページルーティング =====

// 代行申込フォームページ
app.get('/form', (req, res) => {
  res.sendFile(path.join(__dirname, 'form.html'));
});

// 進捗状況ページ
app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'status.html'));
});

// 承認ページ（認証キー入力）
app.get('/approval', (req, res) => {
  res.sendFile(path.join(__dirname, 'approval.html'));
});

// 買取管理ページ
app.get('/kaitori/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'kaitori-admin.html'));
});

// 買取承認ページ
app.get('/kaitori/approval', (req, res) => {
  res.sendFile(path.join(__dirname, 'kaitori-approval.html'));
});

// メッセージ/チャットページ
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/messages', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});

// お問い合わせページ（メッセージページへリダイレクト）
app.get('/contact', (req, res) => {
  res.redirect('/chat');
});

// SPAのフォールバック（HTMLファイルのみ）
app.get('*', (req, res) => {
  // 静的ファイルのリクエストは除外
  if (req.path.includes('.')) {
    return res.status(404).send('File not found');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== エラーハンドリング =====

// 404エラーハンドラ
app.use(notFoundHandler);

// グローバルエラーハンドラ
app.use(errorHandler);

app.listen(port, () => {
  logger.info('Server started successfully', {
    port,
    nodeEnv: process.env.NODE_ENV
  });
  console.log(`Server running on port ${port}`);
  console.log(`- Home: http://localhost:${port}/`);
  console.log(`- Form: http://localhost:${port}/form`);
  console.log(`- Status: http://localhost:${port}/status`);
  console.log(`- Messages: http://localhost:${port}/chat`);
  console.log(`- Approval: http://localhost:${port}/approval`);
  console.log(`- Admin: http://localhost:${port}/admin`);
  console.log(`- Health Check: http://localhost:${port}/api/health`);
  console.log(`- Shopify Test: http://localhost:${port}/api/test/shopify`);
});
