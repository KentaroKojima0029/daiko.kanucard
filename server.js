const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initDatabase, submissionQueries } = require('./database');
const { sendVerificationCode, verifyCode } = require('./sms-auth');
const { createSession, authenticate, optionalAuthenticate, logout } = require('./auth');
const { getCustomerById, getCustomerOrders } = require('./shopify-client');

const app = express();
const port = process.env.PORT || 3000;

// データベース初期化
initDatabase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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

// ===== 認証API =====

// 認証コード送信
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: '電話番号を入力してください' });
    }

    const result = await sendVerificationCode(phoneNumber);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: result.message || '認証コードを送信しました' });
  } catch (error) {
    console.error('Send code error:', error);
    res.status(500).json({ error: '認証コードの送信に失敗しました' });
  }
});

// 認証コード検証
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: '電話番号と認証コードを入力してください' });
    }

    const result = await verifyCode(phoneNumber, code);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // セッション作成
    const token = createSession(result.user.id);

    // クッキーに保存
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'strict'
    });

    res.json({
      success: true,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phoneNumber: result.user.phone_number
      },
      shopifyCustomer: result.shopifyCustomer
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ error: '認証に失敗しました' });
  }
});

// ログアウト
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.auth_token;

  if (token) {
    logout(token);
  }

  res.clearCookie('auth_token');
  res.json({ success: true, message: 'ログアウトしました' });
});

// 現在のユーザー情報取得
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const shopifyCustomer = await getCustomerById(req.user.shopify_customer_id);

    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        phoneNumber: req.user.phone_number
      },
      shopifyCustomer
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
  }
});

// 顧客の代行依頼一覧取得
app.get('/api/submissions', authenticate, (req, res) => {
  try {
    const submissions = submissionQueries.findByUserId.all(req.user.id);
    res.json({ submissions });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: '代行依頼の取得に失敗しました' });
  }
});

// 顧客のShopify注文履歴取得
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const orders = await getCustomerOrders(req.user.shopify_customer_id);
    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: '注文履歴の取得に失敗しました' });
  }
});

// SPAのフォールバック（HTMLファイルのみ）
app.get('*', (req, res) => {
  // 静的ファイルのリクエストは除外
  if (req.path.includes('.')) {
    return res.status(404).send('File not found');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`- User page: http://localhost:${port}/`);
  console.log(`- Status: http://localhost:${port}/status`);
  console.log(`- Approval: http://localhost:${port}/approval`);
  console.log(`- Contact: http://localhost:${port}/contact`);
  console.log(`- Admin: http://localhost:${port}/admin`);
});
