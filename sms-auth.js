const twilio = require('twilio');
const { verificationQueries, userQueries } = require('./database');
const { findCustomerByPhone } = require('./shopify-client');

// Twilio設定
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Twilio クライアント（設定されている場合のみ初期化）
let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_ACCOUNT_SID.startsWith('AC')) {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('Twilio SMS client initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize Twilio client:', error.message);
  }
} else {
  console.warn('Twilio credentials not configured. SMS will be disabled (codes will be printed to console).');
}

// 認証コード生成（6桁の数字）
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 電話番号の正規化（日本の携帯番号を国際形式に）
function normalizePhoneNumber(phoneNumber) {
  // 空白とハイフンを削除
  let normalized = phoneNumber.replace(/[\s-]/g, '');

  // 先頭が0の場合、+81に置き換え
  if (normalized.startsWith('0')) {
    normalized = '+81' + normalized.substring(1);
  } else if (!normalized.startsWith('+')) {
    normalized = '+81' + normalized;
  }

  return normalized;
}

// SMS認証コードを送信
async function sendVerificationCode(phoneNumber) {
  try {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Shopifyで顧客を検索
    const shopifyCustomer = await findCustomerByPhone(phoneNumber);

    if (!shopifyCustomer) {
      return {
        success: false,
        error: 'この電話番号はShopifyに登録されていません。先にShopifyでアカウントを作成してください。'
      };
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10分後に期限切れ

    // データベースに保存
    verificationQueries.create.run(normalizedPhone, code, expiresAt);

    // 開発環境ではコンソールに出力（SMS送信しない）
    if (process.env.NODE_ENV === 'development' || !twilioClient) {
      console.log(`\n====================`);
      console.log(`認証コード: ${code}`);
      console.log(`電話番号: ${normalizedPhone}`);
      console.log(`有効期限: ${expiresAt}`);
      console.log(`====================\n`);
      return { success: true, code, message: '開発モード: コンソールに認証コードを表示しました' };
    }

    // 本番環境ではTwilio経由でSMS送信
    try {
      await twilioClient.messages.create({
        body: `【PSA代行サービス】認証コード: ${code}\n有効期限は10分間です。`,
        from: TWILIO_PHONE_NUMBER,
        to: normalizedPhone
      });

      return { success: true, message: 'SMS送信しました' };
    } catch (smsError) {
      console.error('SMS送信エラー:', smsError);
      // SMS送信失敗でもコードは保存されているので、エラーメッセージを返す
      return { success: false, error: 'SMS送信に失敗しました' };
    }
  } catch (error) {
    console.error('認証コード生成エラー:', error);
    return { success: false, error: '認証コードの生成に失敗しました' };
  }
}

// 認証コードを検証
async function verifyCode(phoneNumber, code) {
  try {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // 最新の未検証コードを取得
    const verification = verificationQueries.findLatest.get(normalizedPhone);

    if (!verification) {
      return { success: false, error: '認証コードが見つかりません' };
    }

    // 試行回数チェック（5回まで）
    if (verification.attempts >= 5) {
      return { success: false, error: '試行回数が上限に達しました。新しい認証コードをリクエストしてください' };
    }

    // コードが一致しない場合
    if (verification.code !== code) {
      verificationQueries.incrementAttempts.run(verification.id);
      return { success: false, error: '認証コードが正しくありません' };
    }

    // 検証成功 - コードを検証済みとしてマーク
    verificationQueries.markAsVerified.run(verification.id);

    // Shopifyから顧客情報を取得
    const shopifyCustomer = await findCustomerByPhone(normalizedPhone);

    if (!shopifyCustomer) {
      return {
        success: false,
        error: 'Shopify顧客情報が見つかりません'
      };
    }

    // ローカルデータベースでユーザーを検索または作成
    let user = userQueries.findByPhoneNumber.get(normalizedPhone);
    if (!user) {
      const fullName = `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim();
      const result = userQueries.create.run(
        shopifyCustomer.email,
        normalizedPhone,
        fullName || null
      );
      user = userQueries.findById.get(result.lastInsertRowid);
    } else {
      // 既存ユーザーの情報を更新
      const fullName = `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim();
      userQueries.update.run(shopifyCustomer.email, fullName, user.id);
      user = userQueries.findById.get(user.id);
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
  verificationQueries.deleteExpired.run();
}

// 定期的にクリーンアップ（30分ごと）
setInterval(cleanupExpiredCodes, 30 * 60 * 1000);

module.exports = {
  sendVerificationCode,
  verifyCode,
  normalizePhoneNumber,
  cleanupExpiredCodes,
};
