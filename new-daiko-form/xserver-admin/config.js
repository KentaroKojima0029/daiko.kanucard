// API設定
const CONFIG = {
    // Render APIエンドポイント
    API_BASE_URL: 'https://new-daiko-form.onrender.com/api',

    // 承認ページURL
    APPROVAL_BASE_URL: 'https://new-daiko-form.onrender.com/approval',

    // 管理者パスワード（本番環境では変更必須）
    // 推奨: この値を環境変数やサーバー側で管理
    ADMIN_PASSWORD: 'kaitori_admin_2025',

    // セッションストレージキー
    SESSION_KEY: 'kaitori_admin_session',

    // ローカルストレージキー（パスワード保存用 - オプション）
    REMEMBER_KEY: 'kaitori_admin_remember',

    // タイムアウト設定（ミリ秒）
    REQUEST_TIMEOUT: 30000,

    // 自動ログアウト時間（ミリ秒）
    SESSION_TIMEOUT: 3600000, // 1時間

    // デバッグモード
    DEBUG: false
};

// ログ出力関数
function log(...args) {
    if (CONFIG.DEBUG) {
        console.log('[Kaitori Admin]', ...args);
    }
}

// エラーログ出力関数
function logError(...args) {
    console.error('[Kaitori Admin Error]', ...args);
}

// 設定をフリーズして変更を防止
Object.freeze(CONFIG);
