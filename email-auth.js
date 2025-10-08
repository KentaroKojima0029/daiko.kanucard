const nodemailer = require('nodemailer');
const database = require('./database');
const { findCustomerByEmail } = require('./shopify-client');

console.log('[Email Auth Init] nodemailer object:', {
  type: typeof nodemailer,
  isObject: typeof nodemailer === 'object',
  keys: Object.keys(nodemailer || {}),
  hasCreateTransporter: typeof nodemailer?.createTransporter,
  nodemailer: nodemailer
});

// SMTP設定（遅延初期化）
let transporter = null;
function getTransporter() {
  if (!transporter) {
    console.log('[Email Auth] Creating transporter, nodemailer type:', typeof nodemailer);
    console.log('[Email Auth] nodemailer.createTransport type:', typeof nodemailer.createTransport);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// 認証コード生成（6桁の数字）
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// メールで認証コードを送信
async function sendVerificationCode(email) {
  try {
    console.log('[Email Auth] Attempting to find Shopify customer for:', email);

    // Shopifyで顧客を検索
    const shopifyCustomer = await findCustomerByEmail(email);

    console.log('[Email Auth] Shopify customer lookup result:', {
      found: !!shopifyCustomer,
      email: shopifyCustomer?.email || 'N/A'
    });

    if (!shopifyCustomer) {
      console.warn('[Email Auth] Customer not found in Shopify for email:', email);
      return {
        success: false,
        error: 'このメールアドレスはShopifyに登録されていません。先にShopifyでアカウントを作成してください。'
      };
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10分後に期限切れ

    // データベースに保存（phone_numberフィールドにemailを格納）
    database.verificationQueries.create.run(email, code, expiresAt);

    // 開発環境ではコンソールに出力（メール送信しない）
    if (process.env.NODE_ENV === 'development' || process.env.MAIL_DEBUG === 'true') {
      console.log(`\n====================`);
      console.log(`認証コード: ${code}`);
      console.log(`メールアドレス: ${email}`);
      console.log(`有効期限: ${expiresAt}`);
      console.log(`====================\n`);
    }

    // メール送信
    try {
      console.log('[Email Auth] Attempting to send email with config:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        from: process.env.FROM_EMAIL,
        to: email,
        hasPassword: !!process.env.SMTP_PASS
      });

      await getTransporter().sendMail({
        from: `"PSA代行サービス" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: '【PSA代行サービス】認証コード',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>認証コード</h2>
            <p>以下の認証コードを入力してログインを完了してください。</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #666; font-size: 14px;">
              このコードの有効期限は10分間です。<br>
              心当たりがない場合は、このメールを無視してください。
            </p>
          </div>
        `,
        text: `【PSA代行サービス】認証コード: ${code}\n有効期限は10分間です。`,
      });

      console.log('[Email Auth] Email sent successfully to:', email);
      return { success: true, message: 'メールに認証コードを送信しました' };
    } catch (mailError) {
      console.error('[Email Auth] メール送信エラー:', {
        error: mailError.message,
        code: mailError.code,
        command: mailError.command,
        responseCode: mailError.responseCode,
        response: mailError.response,
        stack: mailError.stack
      });

      // 開発環境ではメール送信失敗でもコンソールに表示されているので成功とする
      if (process.env.NODE_ENV === 'development' || process.env.MAIL_DEBUG === 'true') {
        return { success: true, message: '開発モード: コンソールに認証コードを表示しました' };
      }

      return { success: false, error: 'メール送信に失敗しました' };
    }
  } catch (error) {
    console.error('認証コード生成エラー:', error);
    return { success: false, error: '認証コードの生成に失敗しました' };
  }
}

// 認証コードを検証
async function verifyCode(email, code) {
  try {
    // 最新の未検証コードを取得（phone_numberフィールドにemailが格納されている）
    const verification = database.verificationQueries.findLatest.get(email);

    if (!verification) {
      return { success: false, error: '認証コードが見つかりません' };
    }

    // 試行回数チェック（5回まで）
    if (verification.attempts >= 5) {
      return { success: false, error: '試行回数が上限に達しました。新しい認証コードをリクエストしてください' };
    }

    // コードが一致しない場合
    if (verification.code !== code) {
      database.verificationQueries.incrementAttempts.run(verification.id);
      return { success: false, error: '認証コードが正しくありません' };
    }

    // 検証成功 - コードを検証済みとしてマーク
    database.verificationQueries.markAsVerified.run(verification.id);

    // Shopifyから顧客情報を取得
    const shopifyCustomer = await findCustomerByEmail(email);

    if (!shopifyCustomer) {
      return {
        success: false,
        error: 'Shopify顧客情報が見つかりません'
      };
    }

    // ローカルデータベースでユーザーを検索または作成
    let user = database.userQueries.findByPhoneNumber.get(email);
    if (!user) {
      const fullName = `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim();
      const result = database.userQueries.create.run(
        shopifyCustomer.email,
        email, // phone_numberフィールドにemailを格納
        fullName || null
      );
      user = database.userQueries.findById.get(result.lastInsertRowid);
    } else {
      // 既存ユーザーの情報を更新
      const fullName = `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim();
      database.userQueries.update.run(shopifyCustomer.email, fullName, user.id);
      user = database.userQueries.findById.get(user.id);
    }

    // Shopify顧客情報も返す
    return {
      success: true,
      user,
      shopifyCustomer
    };
  } catch (error) {
    console.error('認証コード検証エラー:', error);
    return { success: false, error: '認証に失敗しました' };
  }
}

// 期限切れコードのクリーンアップ
function cleanupExpiredCodes() {
  database.verificationQueries.deleteExpired.run();
}

// 定期的にクリーンアップ（30分ごと）
setInterval(cleanupExpiredCodes, 30 * 60 * 1000);

module.exports = {
  sendVerificationCode,
  verifyCode,
  cleanupExpiredCodes,
};
