const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

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

          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 12px; margin: 24px 0;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px;">料金情報</h3>
            <table style="width: 100%; color: white;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">代行手数料</td>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2); text-align: right; font-weight: bold;">${totalFee}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">見込鑑定料</td>
                <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2); text-align: right; font-weight: bold;">${estimatedGradingFee}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0 8px 0; font-size: 16px; font-weight: bold;">支払総額（予定額）</td>
                <td style="padding: 12px 0 8px 0; text-align: right; font-size: 18px; font-weight: bold;">${totalEstimatedFee}</td>
              </tr>
            </table>
          </div>

          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 16px; border-radius: 12px; margin: 16px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 14px;">関税見込み額（15%）※発生時のみ</span>
              <span style="font-weight: bold; font-size: 16px;">${estimatedTax}</span>
            </div>
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
      to: process.env.ADMIN_EMAIL || 'collection@kanucard.com',
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

// 管理者ページのルーティング
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// リッチフォームのルーティング
app.get('/form', (req, res) => {
  res.sendFile(path.join(__dirname, 'form.html'));
});

// その他のルート（利用者向けページ）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`- User page: http://localhost:${port}/`);
  console.log(`- Rich form: http://localhost:${port}/form`);
  console.log(`- Admin page: http://localhost:${port}/admin`);
});
