const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
// 環境変数の読み込み（本番環境では.envファイルを使わず、システムから読み込む）
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 環境変数のデバッグ出力（起動時）
console.log('========================================');
console.log('🚀 Server Starting...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT || 3000);
console.log('Shopify Shop:', process.env.SHOPIFY_SHOP_NAME ? '✓ Configured' : '✗ Missing');
console.log('Shopify Token:', process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ? '✓ Configured' : '✗ Missing');
console.log('SMTP Host:', process.env.SMTP_HOST || 'Not configured');
console.log('SMTP User:', process.env.SMTP_USER || 'Not configured');
console.log('========================================');

const { init: initDatabase, submissionQueries, kaitoriQueries, getDatabase } = require('./database');
const { getCustomerById, getCustomerOrders, listAllCustomers } = require('./shopify-client');
const logger = require('./logger');
const { sendEmail, validateEmailConfig } = require('./email-service');
const { validateApiKey, sendEmailHandler } = require('./email-api-endpoint');
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
    'https://daiko.kanucard.com',
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

// メール設定の検証
const emailConfig = validateEmailConfig();
if (!emailConfig.valid) {
  logger.warn('Email configuration issues', { issues: emailConfig.issues });
} else {
  logger.info('Email service ready', {
    fallbackEnabled: emailConfig.fallbackEnabled,
    apiConfigured: emailConfig.apiConfigured
  });
}

// 静的ファイルの配信（優先）
app.use(express.static(__dirname, {
  maxAge: '1d',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

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
      from: process.env.FROM_EMAIL || 'contact@kanucard.com',
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
      from: process.env.FROM_EMAIL || 'contact@kanucard.com',
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

    // データベースに保存
    let submissionId = null;
    try {
      const result = submissionQueries.create.run(
        null, // user_id (後でShopify連携時に使用)
        contactEmail,
        contactName,
        plan,
        serviceOption,
        purchaseOffer || null,
        returnMethod || null,
        inspectionOption || null,
        JSON.stringify(items), // items配列をJSON文字列に変換
        totalQuantity,
        totalDeclaredValue,
        totalAcquisitionValue,
        totalFee,
        estimatedTax,
        estimatedGradingFee,
        totalEstimatedFee,
        contactBody || null
      );
      submissionId = result.lastInsertRowid;

      logger.info('Form submission saved to database', {
        submissionId,
        email: contactEmail,
        name: contactName
      });
    } catch (dbError) {
      logger.error('Database save error', { error: dbError.message });
      // DBエラーでもメール送信は継続
    }

    // 即座にレスポンスを返す（ユーザーを待たせない）
    res.json({
      success: true,
      message: 'お申し込みありがとうございました。確認メールをお送りしました。',
      submissionId: submissionId // 申請IDを返す
    });

    // メール送信と管理者DB保存をバックグラウンドで非同期実行
    setImmediate(async () => {
      try {
        console.log('[Background] Starting email and DB save process...');

        // メール送信（フォールバック機能付き）
        try {
          await sendEmail(customerMailOptions);
          console.log('[Background] Customer email sent successfully');
        } catch (emailError) {
          console.error('[Background] Customer email send error:', emailError);
        }

        try {
          await sendEmail(adminMailOptions);
          console.log('[Background] Admin email sent successfully');
        } catch (emailError) {
          console.error('[Background] Admin email send error:', emailError);
        }

        // 管理者側データベースにも保存
        try {
          const adminApiUrl = process.env.ADMIN_API_URL || 'https://kanucard-daiko-support.onrender.com';

          // タイムアウト付きfetch（10秒）
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const adminResponse = await fetch(`${adminApiUrl}/api/public/form-submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
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
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!adminResponse.ok) {
            console.error('[Background] 管理者DBへの保存失敗:', await adminResponse.text());
          } else {
            const adminData = await adminResponse.json();
            console.log('[Background] 管理者DBに保存成功:', adminData);
          }
        } catch (adminError) {
          if (adminError.name === 'AbortError') {
            console.error('[Background] 管理者API通信タイムアウト（10秒）');
          } else {
            console.error('[Background] 管理者API通信エラー:', adminError);
          }
        }

        console.log('[Background] All background processes completed');
      } catch (error) {
        console.error('[Background] Unexpected error in background process:', error);
      }
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
      from: process.env.FROM_EMAIL || 'contact@kanucard.com',
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
      from: process.env.FROM_EMAIL || 'contact@kanucard.com',
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
            contact@kanucard.com
          </p>
        </div>
      `
    };

    // メール送信（フォールバック機能付き）
    await sendEmail(adminMailOptions);
    await sendEmail(customerMailOptions);

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

// ===== XserverVPS メール送信API =====

// メール送信APIエンドポイント（VPS上でのみ有効）
app.post('/api/send-email', validateApiKey, sendEmailHandler);

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

// ===== Shopify注文履歴API =====

// ===== 2段階認証用のメモリストア =====
// 本番環境では Redis や Database を使用することを推奨
const otpStore = new Map(); // { email: { otp, expiresAt, attempts } }
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// OTP生成関数
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===== 認証API =====

// ステップ1: メールアドレス検証とOTP送信
app.post('/api/auth/verify-shopify-customer', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'メールアドレスが必要です'
      });
    }

    logger.info('OTP request for customer', { email });

    // デバッグ情報を出力（本番環境でのトラブルシューティング用）
    const isProduction = process.env.NODE_ENV === 'production';
    console.log('============== OTP REQUEST DEBUG ==============');
    console.log(`[OTP] Timestamp: ${new Date().toISOString()}`);
    console.log(`[OTP] Email: ${email}`);
    console.log(`[OTP] Environment: ${process.env.NODE_ENV}`);
    console.log(`[OTP] Shopify Shop: ${process.env.SHOPIFY_SHOP_NAME}`);
    console.log(`[OTP] API Version: ${process.env.SHOPIFY_API_VERSION}`);
    console.log(`[OTP] Token exists: ${!!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN}`);
    console.log(`[OTP] Token length: ${process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.length || 0}`);
    console.log(`[OTP] SMTP Host: ${process.env.SMTP_HOST}`);
    console.log(`[OTP] SMTP Port: ${process.env.SMTP_PORT}`);
    console.log(`[OTP] SMTP User: ${process.env.SMTP_USER}`);
    console.log(`[OTP] FROM Email: ${process.env.FROM_EMAIL}`);
    console.log(`[OTP] Email service fallback: ${process.env.USE_XSERVER_FALLBACK}`);
    console.log('==============================================');

    // Shopifyで顧客が存在するか確認
    let customer = null;
    try {
      console.log('[OTP] Attempting to find customer in Shopify...');
      const { findCustomerByEmail } = require('./shopify-client');
      customer = await findCustomerByEmail(email);
      console.log(`[OTP] Shopify customer lookup result: ${customer ? 'Found' : 'Not found or API error'}`);
      if (customer) {
        console.log(`[OTP] Customer ID: ${customer.id}`);
        console.log(`[OTP] Customer name: ${customer.firstName} ${customer.lastName}`);
      }
    } catch (shopifyError) {
      console.error('============== SHOPIFY API ERROR ==============');
      console.error('[OTP] Shopify API Error:', shopifyError);
      console.error('[OTP] Error type:', shopifyError.constructor.name);
      console.error('[OTP] Error message:', shopifyError.message);
      console.error('[OTP] Error code:', shopifyError.code);
      console.error('[OTP] Error response:', shopifyError.response);
      console.error('[OTP] Full error:', JSON.stringify(shopifyError, null, 2));
      console.error('==============================================');

      logger.error('Shopify API Error', {
        error: shopifyError.message,
        stack: shopifyError.stack,
        email,
        errorDetails: {
          code: shopifyError.code,
          response: shopifyError.response
        }
      });

      // Shopify APIエラーでも処理を続行する（nullとして扱う）
      customer = null;
      console.log('[OTP] Continuing with null customer due to Shopify API error');
    }

    if (!customer) {
      logger.warn('Unregistered email attempted login', { email });
      return res.status(404).json({
        success: false,
        message: '登録されていないメールアドレスです',
        isUnregistered: true,
        registerUrl: 'https://shop.kanucard.com/account/login'
      });
    }

    // OTP生成
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10分間有効

    // デバッグ用: OTPをコンソールに出力
    console.log('================================');
    console.log(`🔐 OTP生成: ${otp}`);
    console.log(`📧 送信先: ${email}`);
    console.log(`⏱️ 有効期限: ${new Date(expiresAt).toLocaleString('ja-JP')}`);
    console.log('================================');

    // OTPをストアに保存
    otpStore.set(email, {
      otp,
      expiresAt,
      attempts: 0,
      customerData: {
        id: customer.id,
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        email: customer.email,
        phone: customer.phone || null,
        tags: customer.tags || []
      }
    });

    // OTPメール送信
    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #667eea; padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">PSA代行サービス</h1>
        </div>
        <div style="padding: 40px 20px; background-color: #f9fafb;">
          <h2 style="color: #1a202c; margin-bottom: 20px;">ログイン認証コード</h2>
          <p style="color: #4a5568; line-height: 1.6;">
            PSA代行サービスへのログインを行うため、以下の認証コードを入力してください。
          </p>
          <div style="background-color: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px;">
              ${otp}
            </span>
          </div>
          <p style="color: #718096; font-size: 14px; line-height: 1.5;">
            ※ この認証コードは10分間有効です。<br>
            ※ このメールに心当たりがない場合は、無視してください。
          </p>
        </div>
        <div style="padding: 20px; background-color: #edf2f7; text-align: center;">
          <p style="color: #718096; font-size: 12px; margin: 0;">
            © 2025 KanuCard PSA代行サービス
          </p>
        </div>
      </div>
    `;

    try {
      // メール送信前のデバッグ情報
      console.log('============== EMAIL SEND DEBUG ==============');
      console.log('[OTP] Attempting to send email:', {
        from: process.env.FROM_EMAIL || 'collection@kanucard.com',
        to: email,
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        smtpUser: process.env.SMTP_USER,
        smtpPassExists: !!process.env.SMTP_PASS,
        fallbackEnabled: process.env.USE_XSERVER_FALLBACK
      });
      console.log('==============================================');

      const emailResult = await sendEmail({
        from: process.env.FROM_EMAIL || 'contact@kanucard.com',
        to: email,
        subject: '【PSA代行サービス】ログイン認証コード',
        text: `PSA代行サービスのログイン認証コードは ${otp} です。このコードは10分間有効です。`,
        html: emailHtml
      });

      console.log('[OTP] Email send result:', emailResult);
      logger.info('OTP sent successfully', { email, result: emailResult });
      console.log('[OTP] ✅ Email sent successfully to:', email);
    } catch (emailError) {
      console.error('============== EMAIL SEND ERROR ==============');
      console.error('[OTP] Failed to send OTP email:', emailError);
      console.error('[OTP] Error type:', emailError.constructor.name);
      console.error('[OTP] Error message:', emailError.message);
      console.error('[OTP] Error code:', emailError.code);
      console.error('[OTP] Error command:', emailError.command);
      console.error('[OTP] Error response:', emailError.response);
      console.error('[OTP] Error responseCode:', emailError.responseCode);
      console.error('[OTP] Full error:', JSON.stringify(emailError, null, 2));
      console.error('==============================================');

      logger.error('Failed to send OTP email', {
        error: emailError.message,
        email: email,
        stack: emailError.stack,
        errorDetails: {
          code: emailError.code,
          command: emailError.command,
          response: emailError.response,
          responseCode: emailError.responseCode
        }
      });
      throw new Error('認証メールの送信に失敗しました。しばらくしてからお試しください。');
    }

    res.json({
      success: true,
      message: '認証コードを送信しました'
    });

  } catch (error) {
    console.error('OTP generation error:', error);
    logger.error('OTP generation error', {
      error: error.message,
      email: req.body.email
    });

    res.status(500).json({
      success: false,
      message: 'システムエラーが発生しました'
    });
  }
});

// ステップ2: OTP検証とトークン発行
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'メールアドレスと認証コードが必要です'
      });
    }

    // OTPストアから情報を取得
    const otpData = otpStore.get(email);

    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: '認証コードの有効期限が切れています'
      });
    }

    // 試行回数チェック
    if (otpData.attempts >= 5) {
      otpStore.delete(email);
      return res.status(429).json({
        success: false,
        message: '試行回数の上限を超えました。もう一度最初からやり直してください'
      });
    }

    // 有効期限チェック
    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({
        success: false,
        message: '認証コードの有効期限が切れています'
      });
    }

    // OTP検証
    console.log(`OTP検証: 保存されたOTP="${otpData.otp}", 入力されたOTP="${otp}"`);

    if (otpData.otp !== otp) {
      otpData.attempts += 1;
      logger.warn('Invalid OTP attempt', {
        email,
        expectedOtp: otpData.otp,
        providedOtp: otp,
        attempts: otpData.attempts
      });
      return res.status(401).json({
        success: false,
        message: '認証コードが正しくありません',
        remainingAttempts: 5 - otpData.attempts
      });
    }

    // JWT トークン生成
    const token = jwt.sign(
      {
        customerId: otpData.customerData.id,
        email: otpData.customerData.email,
        firstName: otpData.customerData.firstName,
        lastName: otpData.customerData.lastName
      },
      JWT_SECRET,
      { expiresIn: '30m' }  // 30分のセッション有効期限
    );

    // OTPストアから削除
    otpStore.delete(email);

    logger.info('Customer authenticated successfully', { email });

    res.json({
      success: true,
      message: 'ログインに成功しました',
      token,
      user: otpData.customerData
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    logger.error('OTP verification error', {
      error: error.message,
      email: req.body.email
    });

    res.status(500).json({
      success: false,
      message: 'システムエラーが発生しました'
    });
  }
});

// トークン検証ミドルウェア
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '認証が必要です'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'トークンが無効です'
      });
    }

    req.user = user;
    next();
  });
};

// セッション更新（リフレッシュ）エンドポイント
app.post('/api/auth/refresh-session', authenticateToken, (req, res) => {
  try {
    // 既存のユーザー情報を使用して新しいトークンを生成
    const newToken = jwt.sign(
      {
        customerId: req.user.customerId,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      JWT_SECRET,
      { expiresIn: '30m' }  // 新しい30分のセッション
    );

    logger.info('Session refreshed for user', { email: req.user.email });

    res.json({
      success: true,
      message: 'セッションが更新されました',
      token: newToken
    });
  } catch (error) {
    logger.error('Session refresh error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'セッションの更新に失敗しました'
    });
  }
});

// 顧客の注文履歴取得（認証必須）
app.get('/api/shopify/customer/:email/orders', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'emailパラメータが必要です'
      });
    }

    logger.info('Fetching customer orders', { email });

    // Shopifyから顧客情報を取得
    const { findCustomerByEmail, getCustomerOrders } = require('./shopify-client');
    const customer = await findCustomerByEmail(email);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: '顧客情報が見つかりません',
        data: {
          customer: null,
          orders: []
        }
      });
    }

    // 注文履歴を取得
    const orders = await getCustomerOrders(customer.id, 50);

    // レスポンスデータの整形
    const formattedOrders = orders.map(order => {
      // 日本円の処理（通貨記号を除去して数値に変換）
      const totalPrice = order.totalPrice ? parseFloat(order.totalPrice.replace(/[^0-9.-]/g, '')) : 0;

      return {
        shopifyOrderId: order.id,
        orderNumber: order.name || order.id.split('/').pop(),
        createdAt: order.createdAt,
        totalPrice: totalPrice.toString(),
        financialStatus: order.financialStatus || 'PENDING',
        fulfillmentStatus: order.fulfillmentStatus || 'UNFULFILLED',
        items: order.lineItems?.edges?.map(edge => ({
          productName: edge.node.title || 'Unknown Product',
          quantity: edge.node.quantity || 1,
          variant: edge.node.variant?.title || null,
          price: edge.node.variant?.price || '0'
        })) || []
      };
    });

    // 顧客情報の整形
    const customerData = {
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email,
      phone: customer.phone || null,
      ordersCount: customer.numberOfOrders?.toString() || '0',
      totalSpent: customer.amountSpent?.amount || '0',
      tags: customer.tags || [],
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    };

    logger.info('Customer orders retrieved successfully', {
      email,
      customerFound: true,
      ordersCount: formattedOrders.length
    });

    res.json({
      success: true,
      message: '注文履歴を取得しました',
      data: {
        customer: customerData,
        orders: formattedOrders
      }
    });

  } catch (error) {
    console.error('Get customer orders error:', error);
    logger.error('Get customer orders error', {
      error: error.message,
      email: req.params.email
    });

    res.status(500).json({
      success: false,
      error: '注文履歴の取得に失敗しました',
      message: error.message
    });
  }
});

// ===== メッセージ管理API =====

// メッセージテーブルの作成
const db = getDatabase();
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_email TEXT,
    sender_name TEXT,
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT 0,
    read_at DATETIME,
    reply_message TEXT,
    replied_at DATETIME
  )
`);
logger.info('Messages table ready');

// メッセージ送信
app.post('/api/messages', async (req, res) => {
  try {
    const { email, name, message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'メッセージが必要です'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO messages (sender_email, sender_name, message)
      VALUES (?, ?, ?)
    `);

    try {
      const result = stmt.run(email || '', name || 'ゲスト', message);
      const messageId = result.lastInsertRowid;
      logger.info('Message saved', { id: messageId, sender: name || 'ゲスト' });

      res.json({
        success: true,
        messageId: Number(messageId),
        timestamp: new Date()
      });
    } catch (err) {
      logger.error('Failed to save message', { error: err });
      return res.status(500).json({
        success: false,
        error: 'メッセージの保存に失敗しました'
      });
    }

  } catch (error) {
    logger.error('Message API error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'システムエラーが発生しました'
    });
  }
});

// メッセージ一覧取得
app.get('/api/messages', (req, res) => {
  try {
    const { email } = req.query;

    let query = `
      SELECT id, sender_email, sender_name, message, timestamp,
             is_read, read_at, reply_message, replied_at
      FROM messages
    `;

    const params = [];

    // メールアドレスでフィルタ（オプション）
    if (email) {
      query += ' WHERE sender_email = ?';
      params.push(email);
    }

    query += ' ORDER BY timestamp DESC LIMIT 100';

    const stmt = db.prepare(query);
    const rows = params.length > 0 ? stmt.all(params[0]) : stmt.all();

    res.json({
      success: true,
      messages: rows
    });
  } catch (err) {
    logger.error('Failed to fetch messages', { error: err });
    return res.status(500).json({
      success: false,
      error: 'メッセージの取得に失敗しました'
    });
  }
});

// メッセージを既読にする
app.put('/api/messages/:id/read', (req, res) => {
  try {
    const messageId = req.params.id;

    const stmt = db.prepare(`
      UPDATE messages
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_read = 0
    `);

    const result = stmt.run(messageId);
    logger.info('Message marked as read', { messageId, changes: result.changes });

    res.json({
      success: true,
      updated: result.changes > 0
    });
  } catch (err) {
    logger.error('Failed to mark message as read', { error: err, messageId: req.params.id });
    return res.status(500).json({
      success: false,
      error: '既読状態の更新に失敗しました'
    });
  }
});

// 未読メッセージ数取得
app.get('/api/messages/unread-count', (req, res) => {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM messages WHERE is_read = 0');
    const row = stmt.get();

    res.json({
      success: true,
      count: row.count
    });
  } catch (err) {
    logger.error('Failed to get unread count', { error: err });
    return res.status(500).json({
      success: false,
      error: '未読数の取得に失敗しました'
    });
  }
});

// 管理者がメッセージに返信
app.post('/api/messages/:id/reply', (req, res) => {
  try {
    const messageId = req.params.id;
    const { reply } = req.body;

    if (!reply) {
      return res.status(400).json({
        success: false,
        error: '返信内容が必要です'
      });
    }

    const stmt = db.prepare(`
      UPDATE messages
      SET reply_message = ?, replied_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(reply, messageId);
    logger.info('Reply saved', { messageId, changes: result.changes });

    res.json({
      success: true,
      updated: result.changes > 0
    });
  } catch (err) {
    logger.error('Failed to save reply', { error: err, messageId: req.params.id });
    return res.status(500).json({
      success: false,
      error: '返信の保存に失敗しました'
    });
  }
});

// ===== 買取承認用 2段階認証API =====

// 買取承認用OTP送信
app.post('/api/auth/customer-otp', async (req, res) => {
  try {
    const { email, approvalKey } = req.body;

    if (!email || !approvalKey) {
      return res.status(400).json({
        success: false,
        error: 'メールアドレスと承認キーが必要です'
      });
    }

    logger.info('Customer OTP request for kaitori approval', { email, hasKey: !!approvalKey });

    // まず承認キーの妥当性を確認（買取依頼が存在するか）
    const kaitoriRequest = kaitoriQueries.findByToken.get(approvalKey);

    if (!kaitoriRequest) {
      return res.status(404).json({
        success: false,
        error: '無効な承認キーです'
      });
    }

    // 有効期限チェック
    if (new Date(kaitoriRequest.valid_until) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'この依頼は有効期限切れです'
      });
    }

    // Shopifyで顧客が存在するか確認
    const { findCustomerByEmail } = require('./shopify-client');
    const customer = await findCustomerByEmail(email);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Shopifyに登録されていないメールアドレスです'
      });
    }

    // OTP生成
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10分間有効

    // デバッグ用: OTPをコンソールに出力
    console.log('================================');
    console.log(`🔐 OTP生成: ${otp}`);
    console.log(`📧 送信先: ${email}`);
    console.log(`⏱️ 有効期限: ${new Date(expiresAt).toLocaleString('ja-JP')}`);
    console.log('================================');

    // 買取承認用のOTPストアキーを作成（通常のOTPと区別）
    const storeKey = `kaitori_${email}_${approvalKey}`;

    // OTPをストアに保存
    otpStore.set(storeKey, {
      otp,
      expiresAt,
      attempts: 0,
      approvalKey,
      customerData: {
        id: customer.id,
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        email: customer.email
      },
      kaitoriData: {
        id: kaitoriRequest.id,
        cardName: kaitoriRequest.card_name
      }
    });

    // OTPメール送信
    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">買取承認システム</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">PSA代行サービス</p>
        </div>
        <div style="padding: 40px 20px; background-color: #f9fafb;">
          <h2 style="color: #1a202c; margin-bottom: 20px; font-size: 22px;">認証コード</h2>

          <p style="color: #4a5568; line-height: 1.8; margin-bottom: 30px; font-size: 16px;">
            <strong>${customer.firstName || ''} ${customer.lastName || ''}</strong> 様<br>
            買取承認画面へのアクセスに必要な認証コードをお送りします。
          </p>

          <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);">
            <p style="color: white; font-size: 14px; margin: 0 0 15px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">認証コード</p>
            <div style="background: rgba(255, 255, 255, 0.95); border-radius: 8px; padding: 20px; display: inline-block;">
              <span style="font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 10px; font-family: 'Courier New', monospace;">
                ${otp}
              </span>
            </div>
          </div>

          <div style="background: #fff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #1e293b; margin: 0 0 12px 0; font-size: 16px;">承認対象カード</h3>
            <p style="color: #64748b; margin: 0; font-size: 15px; line-height: 1.6;">
              <strong style="color: #1e293b;">カード名:</strong> ${kaitoriRequest.card_name}<br>
              ${kaitoriRequest.card_condition ? `<strong style="color: #1e293b;">コンディション:</strong> ${kaitoriRequest.card_condition}` : ''}
            </p>
          </div>

          <p style="color: #718096; font-size: 14px; line-height: 1.7; margin: 25px 0;">
            ※ この認証コードは<strong>10分間</strong>有効です。<br>
            ※ このメールに心当たりがない場合は、無視してください。<br>
            ※ 認証コードは他者に共有しないでください。
          </p>
        </div>
        <div style="padding: 20px; background: linear-gradient(135deg, #f3f4f6, #e5e7eb); text-align: center; border-radius: 0 0 12px 12px;">
          <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">
            ご不明な点がございましたら
          </p>
          <p style="color: #64748b; font-size: 12px; margin: 0;">
            <a href="mailto:contact@kanucard.com" style="color: #667eea; text-decoration: none; font-weight: 600;">contact@kanucard.com</a><br>
            までお問い合わせください
          </p>
        </div>
      </div>
    `;

    await sendEmail({
      to: email,
      from: process.env.FROM_EMAIL || 'contact@kanucard.com',
      subject: '【買取承認】認証コード - PSA代行サービス',
      text: `PSA代行サービスの買取承認用認証コードは ${otp} です。このコードは10分間有効です。`,
      html: emailHtml
    });

    logger.info('Customer OTP sent successfully', { email });

    res.json({
      success: true,
      message: '認証コードを送信しました'
    });

  } catch (error) {
    console.error('Customer OTP generation error:', error);
    logger.error('Customer OTP generation error', {
      error: error.message,
      email: req.body.email
    });

    res.status(500).json({
      success: false,
      error: 'システムエラーが発生しました'
    });
  }
});

// 買取承認用OTP検証
app.post('/api/auth/verify-customer-otp', async (req, res) => {
  try {
    const { email, otp, approvalKey } = req.body;

    if (!email || !otp || !approvalKey) {
      return res.status(400).json({
        success: false,
        error: '必要な情報が不足しています'
      });
    }

    // 買取承認用のOTPストアキーを作成
    const storeKey = `kaitori_${email}_${approvalKey}`;

    // OTPストアから情報を取得
    const otpData = otpStore.get(storeKey);

    if (!otpData) {
      return res.status(400).json({
        success: false,
        error: '認証コードの有効期限が切れています'
      });
    }

    // 試行回数チェック
    if (otpData.attempts >= 5) {
      otpStore.delete(storeKey);
      return res.status(429).json({
        success: false,
        error: '試行回数の上限を超えました。もう一度最初からやり直してください'
      });
    }

    // 有効期限チェック
    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(storeKey);
      return res.status(400).json({
        success: false,
        error: '認証コードの有効期限が切れています'
      });
    }

    // OTP検証
    if (otpData.otp !== otp) {
      otpData.attempts += 1;
      return res.status(401).json({
        success: false,
        error: '認証コードが正しくありません',
        remainingAttempts: 5 - otpData.attempts
      });
    }

    // JWT トークン生成（買取承認用）
    const token = jwt.sign(
      {
        type: 'kaitori_approval',
        customerId: otpData.customerData.id,
        email: otpData.customerData.email,
        firstName: otpData.customerData.firstName,
        lastName: otpData.customerData.lastName,
        approvalKey: otpData.approvalKey,
        kaitoriId: otpData.kaitoriData.id
      },
      JWT_SECRET,
      { expiresIn: '1h' } // 買取承認は1時間のみ有効
    );

    // OTPストアから削除
    otpStore.delete(storeKey);

    logger.info('Customer authenticated for kaitori approval', { email, kaitoriId: otpData.kaitoriData.id });

    res.json({
      success: true,
      message: '認証に成功しました',
      token,
      user: otpData.customerData
    });

  } catch (error) {
    console.error('Customer OTP verification error:', error);
    logger.error('Customer OTP verification error', {
      error: error.message,
      email: req.body.email
    });

    res.status(500).json({
      success: false,
      error: 'システムエラーが発生しました'
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

// ===== 利用者向け申請管理API =====

// 申請履歴取得
app.get('/api/my-submissions', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'メールアドレスが必要です'
      });
    }

    // メールアドレスのバリデーション
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: '有効なメールアドレスを入力してください'
      });
    }

    const submissions = submissionQueries.findByEmail.all(email);

    // items列（JSON文字列）をパースして返す
    const submissionsWithParsedItems = submissions.map(sub => ({
      ...sub,
      items: sub.items ? JSON.parse(sub.items) : []
    }));

    logger.info('Submissions retrieved', {
      email,
      count: submissions.length
    });

    res.json({
      success: true,
      count: submissions.length,
      submissions: submissionsWithParsedItems
    });
  } catch (error) {
    console.error('Get submissions error:', error);
    logger.error('Get submissions error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'データの取得に失敗しました'
    });
  }
});

// 申請詳細取得
app.get('/api/submission/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'メールアドレスが必要です'
      });
    }

    const submission = submissionQueries.findById.get(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: '申請が見つかりません'
      });
    }

    // セキュリティ: メールアドレスが一致する場合のみ返す
    if (submission.email !== email) {
      return res.status(403).json({
        success: false,
        error: 'アクセス権限がありません'
      });
    }

    // items列（JSON文字列）をパース
    const submissionWithParsedItems = {
      ...submission,
      items: submission.items ? JSON.parse(submission.items) : []
    };

    logger.info('Submission detail retrieved', {
      submissionId: id,
      email: submission.email
    });

    res.json({
      success: true,
      submission: submissionWithParsedItems
    });
  } catch (error) {
    console.error('Get submission detail error:', error);
    logger.error('Get submission detail error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'データの取得に失敗しました'
    });
  }
});

// 申請ステータス確認（ID + メールアドレス）
app.get('/api/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'メールアドレスが必要です'
      });
    }

    const submission = submissionQueries.findById.get(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: '申請が見つかりません'
      });
    }

    // セキュリティチェック
    if (submission.email !== email) {
      return res.status(403).json({
        success: false,
        error: 'アクセス権限がありません'
      });
    }

    logger.info('Status checked', {
      submissionId: id,
      status: submission.status
    });

    res.json({
      success: true,
      id: submission.id,
      status: submission.status,
      created_at: submission.created_at,
      updated_at: submission.updated_at
    });
  } catch (error) {
    console.error('Get status error:', error);
    logger.error('Get status error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'ステータスの取得に失敗しました'
    });
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

// ホームページ（認証後のダッシュボード）
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
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
