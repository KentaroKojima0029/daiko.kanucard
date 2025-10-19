// API通信クラス
class KaitoriAPI {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
        this.timeout = CONFIG.REQUEST_TIMEOUT;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            log('API Request:', url, options);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            log('API Response:', data);
            return data;

        } catch (error) {
            clearTimeout(timeoutId);
            logError('API Error:', error);

            if (error.name === 'AbortError') {
                throw new Error('リクエストがタイムアウトしました');
            }
            throw error;
        }
    }

    // 買取依頼作成
    async createRequest(data) {
        return this.request('/kaitori/create', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // 依頼一覧取得
    async listRequests() {
        return this.request('/kaitori/list');
    }

    // 依頼詳細取得
    async getRequestDetail(id) {
        return this.request(`/kaitori/detail/${id}`);
    }
}

// セッション管理クラス
class SessionManager {
    constructor() {
        this.sessionKey = CONFIG.SESSION_KEY;
        this.rememberKey = CONFIG.REMEMBER_KEY;
    }

    login(password, remember = false) {
        if (password !== CONFIG.ADMIN_PASSWORD) {
            throw new Error('パスワードが正しくありません');
        }

        const sessionData = {
            loggedIn: true,
            loginTime: Date.now()
        };

        sessionStorage.setItem(this.sessionKey, JSON.stringify(sessionData));

        if (remember) {
            localStorage.setItem(this.rememberKey, 'true');
        }

        log('Login successful');
        return true;
    }

    logout() {
        sessionStorage.removeItem(this.sessionKey);
        localStorage.removeItem(this.rememberKey);
        log('Logout successful');
    }

    isLoggedIn() {
        const data = sessionStorage.getItem(this.sessionKey);
        if (!data) return false;

        try {
            const session = JSON.parse(data);
            const elapsed = Date.now() - session.loginTime;

            if (elapsed > CONFIG.SESSION_TIMEOUT) {
                this.logout();
                return false;
            }

            return session.loggedIn === true;
        } catch {
            return false;
        }
    }

    shouldRemember() {
        return localStorage.getItem(this.rememberKey) === 'true';
    }
}

// UI管理クラス
class AdminUI {
    constructor() {
        this.api = new KaitoriAPI();
        this.session = new SessionManager();
        this.currentTab = 'create';
        this.init();
    }

    init() {
        // ログイン状態確認
        if (this.session.isLoggedIn()) {
            this.showAdminPanel();
        } else {
            this.showLoginPanel();
        }

        // イベントリスナー設定
        this.setupEventListeners();
    }

    setupEventListeners() {
        // ログインフォーム
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // ログアウトボタン
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // 作成フォーム
        const createForm = document.getElementById('createForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.handleCreate(e));
        }
    }

    showLoginPanel() {
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('adminContainer').classList.remove('show');
    }

    showAdminPanel() {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('adminContainer').classList.add('show');
        this.switchTab('create');
    }

    async handleLogin(e) {
        e.preventDefault();

        const password = document.getElementById('password').value;
        const remember = document.getElementById('remember').checked;
        const submitBtn = e.target.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.textContent = 'ログイン中...';

        try {
            this.session.login(password, remember);
            this.showAdminPanel();
            this.showSuccess('ログインしました');
        } catch (error) {
            this.showError(error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'ログイン';
        }
    }

    handleLogout() {
        if (confirm('ログアウトしますか？')) {
            this.session.logout();
            this.showLoginPanel();
            this.showSuccess('ログアウトしました');
        }
    }

    switchTab(tab) {
        this.currentTab = tab;

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        const tabBtn = document.querySelector(`[data-tab="${tab}"]`);
        const tabContent = document.getElementById(`${tab}Tab`);

        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');

        if (tab === 'list') {
            this.loadRequests();
        }
    }

    async handleCreate(e) {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '作成中...';

        try {
            const data = {
                cardName: document.getElementById('cardName').value,
                cardCondition: document.getElementById('cardCondition').value,
                cardImageUrl: document.getElementById('cardImageUrl').value,
                customerName: document.getElementById('customerName').value,
                customerEmail: document.getElementById('customerEmail').value,
                customerPhone: document.getElementById('customerPhone').value,
                assessmentPrice: document.getElementById('assessmentPrice').value || null,
                assessmentComment: document.getElementById('assessmentComment').value,
                assessorName: document.getElementById('assessorName').value
            };

            const result = await this.api.createRequest(data);

            this.showSuccess('買取依頼を作成しました');

            const approvalUrl = `${CONFIG.APPROVAL_BASE_URL}?id=${result.token}`;
            document.getElementById('generatedUrl').textContent = approvalUrl;
            document.getElementById('urlModal').classList.add('show');

            e.target.reset();

        } catch (error) {
            this.showError(error.message || '作成に失敗しました');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '作成 & URL生成';
        }
    }

    async loadRequests() {
        const tbody = document.getElementById('requestsTableBody');
        tbody.innerHTML = '<tr><td colspan="7" class="loading"><div class="spinner"></div>読み込み中...</td></tr>';

        try {
            const data = await this.api.listRequests();

            if (!data.requests || data.requests.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #94a3b8;">依頼がありません</td></tr>';
                return;
            }

            tbody.innerHTML = data.requests.map(req => `
                <tr>
                    <td>${req.id}</td>
                    <td>${req.card_name}</td>
                    <td>${req.customer_name}</td>
                    <td>¥${req.assessment_price ? Number(req.assessment_price).toLocaleString() : '未設定'}</td>
                    <td>
                        <span class="badge badge-${req.status}">
                            ${req.status === 'pending' ? '未回答' : req.status === 'approved' ? '承認' : '拒否'}
                        </span>
                    </td>
                    <td>${new Date(req.created_at).toLocaleDateString('ja-JP')}</td>
                    <td>
                        <button class="btn btn-small btn-primary" onclick="adminUI.showDetail(${req.id})">詳細</button>
                        <button class="btn btn-small btn-secondary" onclick="adminUI.showUrl('${req.token}')">URL</button>
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            this.showError(error.message || 'データの取得に失敗しました');
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #dc2626;">エラーが発生しました</td></tr>';
        }
    }

    async showDetail(id) {
        try {
            const data = await this.api.getRequestDetail(id);
            const req = data.request;

            const modalBody = document.getElementById('detailModalBody');
            modalBody.innerHTML = `
                <div style="display: grid; gap: 16px;">
                    <div><strong>ID:</strong> ${req.id}</div>
                    <div><strong>カード名:</strong> ${req.card_name}</div>
                    <div><strong>コンディション:</strong> ${req.card_condition || '未記入'}</div>
                    <div><strong>顧客名:</strong> ${req.customer_name}</div>
                    <div><strong>顧客メール:</strong> ${req.customer_email}</div>
                    <div><strong>顧客電話:</strong> ${req.customer_phone || '未記入'}</div>
                    <div><strong>査定価格:</strong> ¥${req.assessment_price ? Number(req.assessment_price).toLocaleString() : '未設定'}</div>
                    <div><strong>査定者:</strong> ${req.assessor_name || '未記入'}</div>
                    <div><strong>査定日:</strong> ${req.assessment_date ? new Date(req.assessment_date).toLocaleDateString('ja-JP') : '未記入'}</div>
                    <div><strong>査定コメント:</strong><br>${req.assessment_comment || '未記入'}</div>
                    <div><strong>ステータス:</strong> ${req.status === 'pending' ? '未回答' : req.status === 'approved' ? '承認' : '拒否'}</div>
                    ${req.response_type ? `<div><strong>回答日:</strong> ${new Date(req.response_date).toLocaleString('ja-JP')}</div>` : ''}
                    ${req.bank_name ? `
                        <div style="margin-top: 16px; padding: 16px; background: #f8fafc; border-radius: 8px;">
                            <strong>振込先情報:</strong><br>
                            銀行: ${req.bank_name}<br>
                            支店: ${req.bank_branch}<br>
                            口座番号: ${req.account_number}<br>
                            口座名義: ${req.account_holder}
                        </div>
                    ` : ''}
                </div>
            `;

            document.getElementById('detailModal').classList.add('show');
        } catch (error) {
            this.showError(error.message || 'データの取得に失敗しました');
        }
    }

    showUrl(token) {
        const url = `${CONFIG.APPROVAL_BASE_URL}?id=${token}`;
        document.getElementById('generatedUrl').textContent = url;
        document.getElementById('urlModal').classList.add('show');
    }

    copyUrl() {
        const url = document.getElementById('generatedUrl').textContent;
        navigator.clipboard.writeText(url).then(() => {
            this.showSuccess('URLをコピーしました');
        }).catch(() => {
            this.showError('コピーに失敗しました');
        });
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }

    showError(message) {
        const errorEl = document.getElementById('errorMessage');
        errorEl.textContent = message;
        errorEl.classList.add('show');
        setTimeout(() => errorEl.classList.remove('show'), 5000);
    }

    showSuccess(message) {
        const successEl = document.getElementById('successMessage');
        successEl.textContent = message;
        successEl.classList.add('show');
        setTimeout(() => successEl.classList.remove('show'), 5000);
    }
}

// グローバル変数として初期化
let adminUI;

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    adminUI = new AdminUI();
});
