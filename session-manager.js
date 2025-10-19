/**
 * セッション管理ユーティリティ
 * 30分のセッション維持と自動更新を提供
 */

class SessionManager {
    constructor() {
        this.SESSION_DURATION = 30 * 60 * 1000; // 30分（ミリ秒）
        this.WARNING_TIME = 5 * 60 * 1000; // 警告を表示する時間（残り5分）
        this.CHECK_INTERVAL = 60 * 1000; // チェック間隔（1分）
        this.lastActivity = null;
        this.sessionTimer = null;
        this.checkTimer = null;
    }

    /**
     * セッション管理を初期化
     */
    init() {
        const token = sessionStorage.getItem('auth_token');
        const loginTime = sessionStorage.getItem('login_time');

        if (!token) {
            console.log('SessionManager: トークンが見つかりません');
            return false;
        }

        // ログイン時刻が記録されていない場合は現在時刻を設定
        if (!loginTime) {
            sessionStorage.setItem('login_time', Date.now().toString());
        }

        this.lastActivity = Date.now();
        this.startSessionTimer();
        this.setupActivityListeners();
        this.startPeriodicCheck();

        console.log('SessionManager: セッション管理を開始しました');
        return true;
    }

    /**
     * ユーザー活動を監視
     */
    setupActivityListeners() {
        // ユーザーのアクティビティを検知
        const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];

        events.forEach(event => {
            document.addEventListener(event, () => {
                this.updateActivity();
            }, { passive: true });
        });
    }

    /**
     * アクティビティを更新
     */
    updateActivity() {
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastActivity;

        // 最後のアクティビティから1分以上経過している場合のみ更新
        if (timeSinceLastActivity > 60000) {
            this.lastActivity = now;
            sessionStorage.setItem('last_activity', now.toString());
            console.log('SessionManager: アクティビティを更新しました');

            // セッションタイマーをリセット
            this.resetSessionTimer();
        }
    }

    /**
     * セッションタイマーを開始
     */
    startSessionTimer() {
        this.clearSessionTimer();

        this.sessionTimer = setTimeout(() => {
            this.handleSessionTimeout();
        }, this.SESSION_DURATION);
    }

    /**
     * セッションタイマーをリセット
     */
    resetSessionTimer() {
        console.log('SessionManager: セッションタイマーをリセットしました');
        this.startSessionTimer();
    }

    /**
     * セッションタイマーをクリア
     */
    clearSessionTimer() {
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
            this.sessionTimer = null;
        }
    }

    /**
     * 定期的なセッションチェック
     */
    startPeriodicCheck() {
        this.checkTimer = setInterval(() => {
            this.checkSession();
        }, this.CHECK_INTERVAL);
    }

    /**
     * セッション状態をチェック
     */
    checkSession() {
        const loginTime = parseInt(sessionStorage.getItem('login_time') || '0');
        const lastActivity = parseInt(sessionStorage.getItem('last_activity') || loginTime.toString());
        const now = Date.now();

        const timeSinceLogin = now - loginTime;
        const timeSinceActivity = now - lastActivity;

        // ログインから30分経過、かつ最後のアクティビティから30分経過
        if (timeSinceLogin > this.SESSION_DURATION && timeSinceActivity > this.SESSION_DURATION) {
            this.handleSessionTimeout();
            return;
        }

        // セッション期限が近づいている場合の警告（残り5分）
        const timeRemaining = this.SESSION_DURATION - timeSinceActivity;
        if (timeRemaining < this.WARNING_TIME && timeRemaining > this.WARNING_TIME - this.CHECK_INTERVAL) {
            this.showSessionWarning(Math.floor(timeRemaining / 60000));
        }

        // トークンの有効期限をチェック
        const token = sessionStorage.getItem('auth_token');
        if (token) {
            try {
                const tokenParts = token.split('.');
                if (tokenParts.length === 3) {
                    const payload = JSON.parse(atob(tokenParts[1]));

                    // トークンの有効期限が切れている場合
                    if (payload.exp && payload.exp * 1000 < now) {
                        console.log('SessionManager: トークンの有効期限が切れました');
                        this.handleSessionTimeout();
                    }
                }
            } catch (error) {
                console.error('SessionManager: トークンの検証に失敗しました', error);
            }
        }
    }

    /**
     * セッション警告を表示
     */
    showSessionWarning(minutesRemaining) {
        // 既存の警告を削除
        const existingWarning = document.getElementById('session-warning');
        if (existingWarning) {
            existingWarning.remove();
        }

        const warningDiv = document.createElement('div');
        warningDiv.id = 'session-warning';
        warningDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #f59e0b, #f97316);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-family: sans-serif;
            max-width: 360px;
            animation: slideIn 0.3s ease-out;
        `;

        warningDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 24px;">⚠️</div>
                <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">セッション期限が近づいています</div>
                    <div style="font-size: 14px; opacity: 0.95;">
                        あと${minutesRemaining}分でログアウトされます。
                        操作を続ける場合はページ内をクリックしてください。
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(warningDiv);

        // 10秒後に警告を自動で削除
        setTimeout(() => {
            if (warningDiv.parentNode) {
                warningDiv.remove();
            }
        }, 10000);
    }

    /**
     * セッションタイムアウト処理
     */
    handleSessionTimeout() {
        console.log('SessionManager: セッションタイムアウト');

        // タイマーをクリア
        this.clearSessionTimer();
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }

        // セッション情報をクリア
        sessionStorage.clear();
        localStorage.removeItem('chatUser');

        // タイムアウトメッセージを表示
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            color: #1e293b;
            padding: 32px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
            z-index: 10001;
            text-align: center;
            max-width: 400px;
            font-family: sans-serif;
        `;

        messageDiv.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">⏱️</div>
            <h2 style="margin-bottom: 12px; color: #1e293b;">セッションタイムアウト</h2>
            <p style="color: #64748b; margin-bottom: 24px;">
                セキュリティのため、30分間操作がなかったためログアウトしました。
            </p>
            <button onclick="window.location.href='/'" style="
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white;
                border: none;
                padding: 12px 32px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
            ">ログインページへ</button>
        `;

        document.body.appendChild(messageDiv);

        // 5秒後に自動的にログインページへリダイレクト
        setTimeout(() => {
            window.location.href = '/';
        }, 5000);
    }

    /**
     * セッションを手動で延長
     */
    extendSession() {
        this.lastActivity = Date.now();
        sessionStorage.setItem('last_activity', this.lastActivity.toString());
        this.resetSessionTimer();
        console.log('SessionManager: セッションを延長しました');

        // 延長通知を表示
        this.showSessionExtended();
    }

    /**
     * セッション延長通知を表示
     */
    showSessionExtended() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            font-family: sans-serif;
            animation: slideUp 0.3s ease-out;
        `;

        notification.innerHTML = '✅ セッションが延長されました';
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * セッション情報を取得
     */
    getSessionInfo() {
        const loginTime = parseInt(sessionStorage.getItem('login_time') || '0');
        const lastActivity = parseInt(sessionStorage.getItem('last_activity') || loginTime.toString());
        const now = Date.now();

        return {
            isActive: !!sessionStorage.getItem('auth_token'),
            loginTime: new Date(loginTime),
            lastActivity: new Date(lastActivity),
            timeSinceLogin: Math.floor((now - loginTime) / 1000 / 60), // 分
            timeSinceActivity: Math.floor((now - lastActivity) / 1000 / 60), // 分
            timeRemaining: Math.max(0, Math.floor((this.SESSION_DURATION - (now - lastActivity)) / 1000 / 60)) // 分
        };
    }

    /**
     * クリーンアップ
     */
    destroy() {
        this.clearSessionTimer();
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
        console.log('SessionManager: セッション管理を終了しました');
    }
}

// グローバルに公開
if (typeof window !== 'undefined') {
    window.SessionManager = SessionManager;

    // ページ読み込み時に自動初期化
    document.addEventListener('DOMContentLoaded', () => {
        const sessionManager = new SessionManager();
        if (sessionManager.init()) {
            window.sessionManager = sessionManager;
        }
    });
}

// Node.js環境でのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionManager;
}