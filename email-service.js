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
const USE_XSERVER_FALLBACK = process.env.USE_XSERVER_FALLBACK === 'true';
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

  // 1. まずSMTP送信を試行
  try {
    const result = await sendViaSMTP(mailOptions);
    return result;
  } catch (smtpError) {
    errors.push({
      method: 'smtp',
      error: smtpError.message
    });

    logger.warn('SMTP send failed, attempting fallback', {
      error: smtpError.message,
      fallbackEnabled: USE_XSERVER_FALLBACK
    });
  }

  // 2. SMTP失敗時、フォールバックが有効ならXserverVPS APIを試行
  if (USE_XSERVER_FALLBACK) {
    try {
      const result = await sendViaXserverAPI(mailOptions);
      return result;
    } catch (apiError) {
      errors.push({
        method: 'xserver-api',
        error: apiError.message
      });

      logger.error('XserverVPS API fallback also failed', {
        error: apiError.message
      });
    }
  }

  // 3. すべての方法が失敗した場合
  const errorMessage = errors.map(e => `${e.method}: ${e.error}`).join('; ');

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

  // SMTP設定チェック
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    issues.push('SMTP configuration incomplete');
  }

  // フォールバック設定チェック
  if (USE_XSERVER_FALLBACK) {
    if (!XSERVER_API_URL) {
      issues.push('XSERVER_API_URL not set');
    }
    if (!XSERVER_API_KEY) {
      issues.push('XSERVER_API_KEY not set');
    }
  }

  if (issues.length > 0) {
    logger.warn('Email configuration issues detected', { issues });
    return {
      valid: false,
      issues
    };
  }

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
