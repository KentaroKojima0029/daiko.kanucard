/**
 * メール送信サービス（SMTPフォールバック機能付き）
 *
 * このサービスは以下の戦略でメールを送信します：
 * 1. 直接SMTP送信を試行（タイムアウト: 15秒）
 * 2. 失敗した場合、XserverVPS APIにフォールバック
 * 3. 両方失敗した場合はエラーを返す
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

// 環境変数から設定を取得
// USE_XSERVER_FALLBACKは'true'、'1'、'yes'のいずれかで有効化
const USE_XSERVER_FALLBACK = ['true', '1', 'yes'].includes(
  String(process.env.USE_XSERVER_FALLBACK || '').toLowerCase()
);
const XSERVER_API_URL = process.env.XSERVER_API_URL;
const XSERVER_API_KEY = process.env.XSERVER_API_KEY;

// Nodemailer transporter設定
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'sv10210.xserver.jp',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'collection@kanucard.com',
    pass: process.env.SMTP_PASS
  },
  connectionTimeout: 15000, // 15秒（短めに設定してフォールバックを早める）
  greetingTimeout: 10000,   // 10秒
  socketTimeout: 15000,     // 15秒
  logger: process.env.NODE_ENV !== 'production',
  debug: process.env.NODE_ENV !== 'production'
});

/**
 * XserverVPS APIを使用したメール送信（フォールバック）
 */
async function sendViaXserverAPI(mailOptions) {
  if (!XSERVER_API_URL || !XSERVER_API_KEY) {
    throw new Error('XserverVPS API configuration missing');
  }

  logger.info('Attempting to send via XserverVPS API', {
    to: mailOptions.to,
    subject: mailOptions.subject,
    apiUrl: XSERVER_API_URL
  });

  try {
    // タイムアウト付きfetch（30秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${XSERVER_API_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': XSERVER_API_KEY
      },
      body: JSON.stringify({
        from: mailOptions.from,
        to: mailOptions.to,
        replyTo: mailOptions.replyTo,
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();

    logger.info('Email sent successfully via XserverVPS API', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      messageId: result.messageId
    });

    return {
      success: true,
      method: 'xserver-api',
      messageId: result.messageId
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      logger.error('XserverVPS API timeout', {
        to: mailOptions.to,
        subject: mailOptions.subject
      });
      throw new Error('XserverVPS API timeout after 30 seconds');
    }

    logger.error('XserverVPS API send error', {
      error: error.message,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    throw error;
  }
}

/**
 * 直接SMTP送信を試行
 */
async function sendViaSMTP(mailOptions) {
  logger.info('Attempting to send via direct SMTP', {
    to: mailOptions.to,
    subject: mailOptions.subject,
    host: process.env.SMTP_HOST
  });

  try {
    const info = await transporter.sendMail(mailOptions);

    logger.info('Email sent successfully via SMTP', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      messageId: info.messageId,
      response: info.response
    });

    return {
      success: true,
      method: 'smtp',
      messageId: info.messageId
    };

  } catch (error) {
    logger.error('SMTP send error', {
      error: error.message,
      code: error.code,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    throw error;
  }
}

/**
 * メール送信（フォールバック機能付き）
 *
 * @param {Object} mailOptions - Nodemailerのメールオプション
 * @returns {Promise<Object>} 送信結果
 */
async function sendEmail(mailOptions) {
  const errors = [];

  // ログ: メール送信開始
  console.log('============================================');
  console.log('[email-service] Starting email send process');
  console.log('[email-service] To:', mailOptions.to);
  console.log('[email-service] Subject:', mailOptions.subject);
  console.log('[email-service] Fallback enabled:', USE_XSERVER_FALLBACK);
  console.log('[email-service] API configured:', !!(XSERVER_API_URL && XSERVER_API_KEY));
  console.log('============================================');

  // 1. まずSMTP送信を試行
  try {
    console.log('[email-service] Attempting SMTP send...');
    const result = await sendViaSMTP(mailOptions);
    console.log('[email-service] ✓ SMTP send successful');
    return result;
  } catch (smtpError) {
    console.error('[email-service] ✗ SMTP send failed:', smtpError.message);
    console.error('[email-service] SMTP error code:', smtpError.code);

    errors.push({
      method: 'smtp',
      error: smtpError.message,
      code: smtpError.code
    });

    logger.warn('SMTP send failed, attempting fallback', {
      error: smtpError.message,
      code: smtpError.code,
      fallbackEnabled: USE_XSERVER_FALLBACK,
      apiConfigured: !!(XSERVER_API_URL && XSERVER_API_KEY)
    });
  }

  // 2. SMTP失敗時、フォールバックが有効ならXserverVPS APIを試行
  if (USE_XSERVER_FALLBACK) {
    console.log('[email-service] Fallback is enabled, checking API configuration...');

    if (!XSERVER_API_URL) {
      console.error('[email-service] ✗ XSERVER_API_URL not configured!');
      errors.push({
        method: 'xserver-api',
        error: 'XSERVER_API_URL not configured'
      });
    } else if (!XSERVER_API_KEY) {
      console.error('[email-service] ✗ XSERVER_API_KEY not configured!');
      errors.push({
        method: 'xserver-api',
        error: 'XSERVER_API_KEY not configured'
      });
    } else {
      try {
        console.log('[email-service] Attempting XserverVPS API fallback...');
        const result = await sendViaXserverAPI(mailOptions);
        console.log('[email-service] ✓ XserverVPS API send successful');
        return result;
      } catch (apiError) {
        console.error('[email-service] ✗ XserverVPS API failed:', apiError.message);

        errors.push({
          method: 'xserver-api',
          error: apiError.message
        });

        logger.error('XserverVPS API fallback also failed', {
          error: apiError.message
        });
      }
    }
  } else {
    console.warn('[email-service] Fallback is disabled (USE_XSERVER_FALLBACK not set to true)');
  }

  // 3. すべての方法が失敗した場合
  const errorMessage = errors.map(e => `${e.method}: ${e.error}`).join('; ');

  console.error('============================================');
  console.error('[email-service] All email sending methods failed');
  console.error('[email-service] Errors:', JSON.stringify(errors, null, 2));
  console.error('============================================');

  logger.error('All email sending methods failed', {
    to: mailOptions.to,
    subject: mailOptions.subject,
    errors
  });

  throw new Error(`Failed to send email. Attempts: ${errorMessage}`);
}

/**
 * メール送信設定の検証
 */
function validateEmailConfig() {
  const issues = [];

  console.log('============================================');
  console.log('[email-service] Validating email configuration');
  console.log('============================================');

  // SMTP設定チェック
  console.log('[email-service] SMTP Configuration:');
  console.log('  - SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
  console.log('  - SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET');
  console.log('  - SMTP_USER:', process.env.SMTP_USER || 'NOT SET');
  console.log('  - SMTP_PASS:', process.env.SMTP_PASS ? '****' : 'NOT SET');

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    issues.push('SMTP configuration incomplete');
    console.error('[email-service] ✗ SMTP configuration incomplete!');
  } else {
    console.log('[email-service] ✓ SMTP configuration complete');
  }

  // フォールバック設定チェック
  console.log('[email-service] Fallback Configuration:');
  console.log('  - USE_XSERVER_FALLBACK (raw):', process.env.USE_XSERVER_FALLBACK || 'NOT SET');
  console.log('  - USE_XSERVER_FALLBACK (parsed):', USE_XSERVER_FALLBACK);
  console.log('  - XSERVER_API_URL:', XSERVER_API_URL || 'NOT SET');
  console.log('  - XSERVER_API_KEY:', XSERVER_API_KEY ? '****' : 'NOT SET');

  if (USE_XSERVER_FALLBACK) {
    if (!XSERVER_API_URL) {
      issues.push('XSERVER_API_URL not set');
      console.error('[email-service] ✗ XSERVER_API_URL not set!');
    }
    if (!XSERVER_API_KEY) {
      issues.push('XSERVER_API_KEY not set');
      console.error('[email-service] ✗ XSERVER_API_KEY not set!');
    }

    if (XSERVER_API_URL && XSERVER_API_KEY) {
      console.log('[email-service] ✓ Fallback configuration complete');
    }
  } else {
    console.warn('[email-service] ⚠ Fallback is DISABLED');
    console.warn('[email-service] Set USE_XSERVER_FALLBACK=true to enable');
  }

  console.log('============================================');

  if (issues.length > 0) {
    console.error('[email-service] Configuration issues:', issues);
    logger.warn('Email configuration issues detected', { issues });
    return {
      valid: false,
      issues
    };
  }

  console.log('[email-service] ✓ Email configuration valid');
  logger.info('Email configuration validated', {
    smtpConfigured: true,
    fallbackEnabled: USE_XSERVER_FALLBACK,
    apiConfigured: !!(XSERVER_API_URL && XSERVER_API_KEY)
  });

  return {
    valid: true,
    smtpConfigured: true,
    fallbackEnabled: USE_XSERVER_FALLBACK,
    apiConfigured: !!(XSERVER_API_URL && XSERVER_API_KEY)
  };
}

module.exports = {
  sendEmail,
  validateEmailConfig,
  transporter // 後方互換性のためエクスポート
};
