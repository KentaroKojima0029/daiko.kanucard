/**
 * PSA鑑定代行APIクライアント
 * すべてのAPI機能を統合したメインエクスポートファイル
 *
 * @example
 * import api from '@/lib/api';
 *
 * // ログイン
 * const user = await api.auth.login(email, password);
 *
 * // 管理者権限の確認
 * const isAdmin = await api.auth.isAdmin();
 *
 * // フォーム送信
 * const result = await api.forms.submitForm(formData);
 *
 * // 申請履歴取得
 * const myForms = await api.forms.getMyForms();
 *
 * // 管理者: ダッシュボード取得
 * const dashboard = await api.admin.getDashboard();
 *
 * // 管理者: 全申請一覧取得
 * const allForms = await api.admin.getForms({ status: 'pending' });
 *
 * // 管理者: ステータス更新
 * await api.admin.updateFormStatus(formId, 'processing');
 */

import apiClient from './apiClient.js';
import authAPI from './auth.js';
import adminAPI from './admin.js';
import formsAPI from './forms.js';
import * as config from './config.js';

// 通知API（オプション）
class NotificationsAPI {
  /**
   * 通知一覧を取得
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 通知一覧
   */
  async getNotifications(options = {}) {
    const params = {
      page: options.page || 1,
      limit: options.limit || 20,
      unreadOnly: options.unreadOnly || false,
    };

    return apiClient.get(config.API_ENDPOINTS.notifications.list, { params });
  }

  /**
   * 通知を既読にする
   * @param {string} notificationId - 通知ID
   * @returns {Promise<Object>} 更新結果
   */
  async markAsRead(notificationId) {
    const endpoint = config.API_ENDPOINTS.notifications.markRead.replace('{id}', notificationId);
    return apiClient.patch(endpoint);
  }

  /**
   * すべての通知を既読にする
   * @returns {Promise<Object>} 更新結果
   */
  async markAllAsRead() {
    return apiClient.patch(config.API_ENDPOINTS.notifications.markAllRead);
  }
}

// ShopifyAPI
class ShopifyAPI {
  /**
   * 顧客の注文履歴を取得
   * @param {string} email - 顧客のメールアドレス
   * @returns {Promise<Object>} 注文履歴と顧客情報
   */
  async getCustomerOrders(email) {
    try {
      if (!email) {
        throw {
          success: false,
          message: 'メールアドレスが必要です',
          code: config.ERROR_CODES.VALIDATION_ERROR,
        };
      }

      // サーバーのAPIエンドポイントを直接呼び出し
      const response = await fetch(
        `${apiClient.baseURL}/api/shopify/customer/${encodeURIComponent(email)}/orders`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiClient.getToken()}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw {
          success: false,
          message: errorData.message || '注文履歴の取得に失敗しました',
          code: response.status === 404 ? config.ERROR_CODES.NOT_FOUND : config.ERROR_CODES.SERVER_ERROR,
        };
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Shopify customer orders error:', error);
      throw error;
    }
  }

  /**
   * 顧客情報を取得（メールアドレス）
   * @param {string} email - 顧客のメールアドレス
   * @returns {Promise<Object>} 顧客情報
   */
  async getCustomerByEmail(email) {
    try {
      const result = await this.getCustomerOrders(email);
      if (result.success && result.data) {
        return {
          success: true,
          data: result.data.customer
        };
      }
      return result;
    } catch (error) {
      console.error('Shopify customer info error:', error);
      throw error;
    }
  }
}

// ファイルアップロードAPI
class UploadAPI {
  /**
   * 画像をアップロード
   * @param {File} file - 画像ファイル
   * @param {Object} options - オプション
   * @returns {Promise<Object>} アップロード結果
   */
  async uploadImage(file, options = {}) {
    if (!file) {
      throw {
        success: false,
        message: 'ファイルが選択されていません',
        code: config.ERROR_CODES.VALIDATION_ERROR,
      };
    }

    // ファイルタイプのチェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw {
        success: false,
        message: '画像ファイル（JPEG、PNG、GIF、WebP）のみアップロード可能です',
        code: config.ERROR_CODES.VALIDATION_ERROR,
      };
    }

    // ファイルサイズのチェック（10MB以下）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw {
        success: false,
        message: 'ファイルサイズは10MB以下にしてください',
        code: config.ERROR_CODES.VALIDATION_ERROR,
      };
    }

    return apiClient.upload(config.API_ENDPOINTS.upload.image, file, options);
  }

  /**
   * ドキュメントをアップロード
   * @param {File} file - ドキュメントファイル
   * @param {Object} options - オプション
   * @returns {Promise<Object>} アップロード結果
   */
  async uploadDocument(file, options = {}) {
    if (!file) {
      throw {
        success: false,
        message: 'ファイルが選択されていません',
        code: config.ERROR_CODES.VALIDATION_ERROR,
      };
    }

    // ファイルタイプのチェック
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      throw {
        success: false,
        message: 'ドキュメントファイル（PDF、Word、Excel、テキスト、CSV）のみアップロード可能です',
        code: config.ERROR_CODES.VALIDATION_ERROR,
      };
    }

    // ファイルサイズのチェック（20MB以下）
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      throw {
        success: false,
        message: 'ファイルサイズは20MB以下にしてください',
        code: config.ERROR_CODES.VALIDATION_ERROR,
      };
    }

    return apiClient.upload(config.API_ENDPOINTS.upload.document, file, options);
  }
}

// ユーティリティ関数
const utils = {
  /**
   * 現在の認証状態を確認
   * @returns {boolean} ログイン済みかどうか
   */
  isLoggedIn() {
    return !!apiClient.getToken();
  },

  /**
   * 管理者権限を確認
   * @returns {boolean} 管理者権限があるかどうか
   */
  isAdmin() {
    const user = apiClient.getUser();
    return user && user.role === 'admin';
  },

  /**
   * 現在のユーザー情報を取得（キャッシュから）
   * @returns {Object|null} ユーザー情報
   */
  getCurrentUser() {
    return apiClient.getUser();
  },

  /**
   * APIエラーをユーザーフレンドリーなメッセージに変換
   * @param {Object} error - エラーオブジェクト
   * @returns {string} エラーメッセージ
   */
  getErrorMessage(error) {
    if (error.message) {
      return error.message;
    }
    if (error.code && config.ERROR_MESSAGES[error.code]) {
      return config.ERROR_MESSAGES[error.code];
    }
    return 'エラーが発生しました。もう一度お試しください。';
  },

  /**
   * 日時を日本語形式にフォーマット
   * @param {string|Date} date - 日時
   * @param {boolean} includeTime - 時刻を含めるか
   * @returns {string} フォーマット済み日時
   */
  formatDateTime(date, includeTime = true) {
    if (!date) return '';

    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    if (!includeTime) {
      return `${year}年${month}月${day}日`;
    }

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
  },

  /**
   * 金額を日本円形式にフォーマット
   * @param {number} amount - 金額
   * @returns {string} フォーマット済み金額
   */
  formatCurrency(amount) {
    if (amount === null || amount === undefined) return '¥0';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  },

  /**
   * 電話番号を日本の形式にフォーマット
   * @param {string} phone - 電話番号
   * @returns {string} フォーマット済み電話番号
   */
  formatPhoneNumber(phone) {
    if (!phone) return '';

    // ハイフンを削除
    const numbers = phone.replace(/[^\d]/g, '');

    // 携帯電話の場合（090、080、070など）
    if (numbers.match(/^0[789]0/)) {
      return numbers.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
    }

    // 固定電話の場合（東京03など）
    if (numbers.match(/^0[1-9]/)) {
      if (numbers.length === 10) {
        // 市外局番が2桁の場合
        if (numbers.match(/^0[1-9]\d{8}$/)) {
          return numbers.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1-$2-$3');
        }
        // 市外局番が3桁の場合
        return numbers.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
      } else if (numbers.length === 11) {
        // 市外局番が4桁の場合
        return numbers.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1-$2-$3');
      }
    }

    return phone;
  },

  /**
   * ファイルサイズを人間が読みやすい形式に変換
   * @param {number} bytes - バイト数
   * @returns {string} フォーマット済みサイズ
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  },
};

// インスタンスの作成
const notificationsAPI = new NotificationsAPI();
const shopifyAPI = new ShopifyAPI();
const uploadAPI = new UploadAPI();

// メインAPIオブジェクト
const api = {
  // 各APIモジュール
  auth: authAPI,
  admin: adminAPI,
  forms: formsAPI,
  notifications: notificationsAPI,
  shopify: shopifyAPI,
  upload: uploadAPI,

  // 基底クライアント（直接アクセスが必要な場合）
  client: apiClient,

  // 設定
  config: config,

  // ユーティリティ
  utils: utils,

  // ショートカットメソッド
  login: (email, password) => authAPI.login(email, password),
  logout: () => authAPI.logout(),
  register: (userData) => authAPI.register(userData),
  submitForm: (formData) => formsAPI.submitForm(formData),
  getMyForms: (options) => formsAPI.getMyForms(options),
  sendMessage: (messageData) => formsAPI.sendMessage(messageData),

  // 初期化メソッド（必要に応じて）
  init(options = {}) {
    // カスタム設定の適用
    if (options.baseURL) {
      apiClient.baseURL = options.baseURL;
    }
    if (options.timeout) {
      apiClient.timeout = options.timeout;
    }
    if (options.headers) {
      apiClient.headers = { ...apiClient.headers, ...options.headers };
    }

    // 自動トークンリフレッシュの設定（オプション）
    if (options.enableAutoRefresh) {
      this.setupAutoTokenRefresh();
    }

    return this;
  },

  // 自動トークンリフレッシュのセットアップ
  setupAutoTokenRefresh() {
    // 5分ごとにトークンの有効性をチェック
    setInterval(async () => {
      if (this.utils.isLoggedIn()) {
        try {
          const isValid = await authAPI.isAuthenticated();
          if (!isValid) {
            // トークンが無効な場合はリフレッシュを試みる
            await authAPI.refreshToken();
          }
        } catch (error) {
          console.error('Auto token refresh failed:', error);
        }
      }
    }, 5 * 60 * 1000); // 5分
  },
};

// デフォルトエクスポート
export default api;

// 名前付きエクスポート（個別インポートが必要な場合）
export {
  apiClient,
  authAPI,
  adminAPI,
  formsAPI,
  notificationsAPI,
  shopifyAPI,
  uploadAPI,
  config,
  utils,
};