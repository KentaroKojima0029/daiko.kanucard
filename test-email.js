// メール送信テストスクリプト
require('dotenv').config();
const { sendEmail } = require('./email-service');

async function testEmail() {
  const testEmail = 'kn24012300@gmail.com';
  const otp = '123456';

  console.log('=== メール送信テスト開始 ===');
  console.log('送信先:', testEmail);
  console.log('FROM_EMAIL:', process.env.FROM_EMAIL);
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('');

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
    console.log('メール送信を開始します...');

    const result = await sendEmail({
      from: process.env.FROM_EMAIL || 'contact@kanucard.com',
      to: testEmail,
      subject: '【テスト】PSA代行サービス - ログイン認証コード',
      text: `PSA代行サービスのログイン認証コードは ${otp} です。このコードは10分間有効です。`,
      html: emailHtml
    });

    console.log('✅ メール送信成功!');
    console.log('結果:', result);
  } catch (error) {
    console.error('❌ メール送信失敗!');
    console.error('エラー:', error.message);
    console.error('詳細:', error);
  }
}

testEmail();