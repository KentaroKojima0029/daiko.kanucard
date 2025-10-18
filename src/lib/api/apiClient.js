/**
 * APIクライアント基底クラス
 * HTTP通信の基本機能とJWTトークン管理、エラーハンドリングを提供
 */

import {
  API_CONFIG,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  ENV,
  ERROR_CODES,
  ERROR_MESSAGES
} from './config.js';

class APIClient {
  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.timeout = API_CONFIG.timeout;
    this.headers = { ...API_CONFIG.headers };
    this.retry = { ...API_CONFIG.retry };
    this.abortControllers = new Map();
  }

  /**
   * JWTトークンを取得
   */
  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  }

  /**
   * リフレッシュトークンを取得
   */
  getRefreshToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return null;
  }

  /**
   * トークンを保存
   */
  setToken(token, refreshToken = null) {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      }
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
    }
  }

  /**
   * トークンを削除
   */
  removeToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  /**
   * ユーザー情報を取得
   */
  getUser() {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem(USER_KEY);
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * ユーザー情報を保存
   */
  setUser(user) {
    if (typeof window !== 'undefined' && user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  /**
   * URLにパラメータを置換
   */
  buildUrl(endpoint, params = {}) {
    let url = `${this.baseURL}${endpoint}`;

    // URLパラメータの置換 (例: /forms/{id} -> /forms/123)
    Object.keys(params).forEach(key => {
      const placeholder = `{${key}}`;
      if (url.includes(placeholder)) {
        url = url.replace(placeholder, params[key]);
        delete params[key];
      }
    });

    // クエリパラメータの追加
    const queryParams = new URLSearchParams(params);
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }

    return url;
  }

  /**
   * リクエストヘッダーを構築
   */
  buildHeaders(customHeaders = {}) {
    const headers = {
      ...this.headers,
      ...customHeaders,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * エラーレスポンスを処理
   */
  async handleErrorResponse(response) {
    let errorData = {
      success: false,
      message: ERROR_MESSAGES[ERROR_CODES.SERVER_ERROR],
      code: ERROR_CODES.SERVER_ERROR,
      status: response.status,
    };

    try {
      const data = await response.json();
      errorData = {
        ...errorData,
        ...data,
        message: data.message || errorData.message,
      };
    } catch (e) {
      // JSONパースエラーは無視
    }

    // ステータスコードに基づくエラーコード設定
    switch (response.status) {
      case 400:
        errorData.code = ERROR_CODES.BAD_REQUEST;
        break;
      case 401:
        errorData.code = ERROR_CODES.UNAUTHORIZED;
        if (errorData.message.includes('expired')) {
          errorData.code = ERROR_CODES.TOKEN_EXPIRED;
        }
        break;
      case 403:
        errorData.code = ERROR_CODES.FORBIDDEN;
        break;
      case 404:
        errorData.code = ERROR_CODES.NOT_FOUND;
        break;
      case 422:
        errorData.code = ERROR_CODES.VALIDATION_ERROR;
        break;
      case 409:
        errorData.code = ERROR_CODES.DUPLICATE_ENTRY;
        break;
      case 500:
      case 502:
      case 503:
        errorData.code = ERROR_CODES.SERVER_ERROR;
        break;
      default:
        break;
    }

    // エラーメッセージの取得
    if (!errorData.message || errorData.message === '') {
      errorData.message = ERROR_MESSAGES[errorData.code] || ERROR_MESSAGES[ERROR_CODES.SERVER_ERROR];
    }

    return errorData;
  }

  /**
   * リトライ可能かどうかを判定
   */
  isRetryable(status) {
    return this.retry.retryableStatuses.includes(status);
  }

  /**
   * リクエストのログ出力
   */
  logRequest(method, url, options) {
    if (ENV.enableLogs || ENV.isDevelopment) {
      console.group(`🚀 API Request: ${method} ${url}`);
      console.log('Headers:', options.headers);
      if (options.body) {
        try {
          console.log('Body:', JSON.parse(options.body));
        } catch (e) {
          console.log('Body:', options.body);
        }
      }
      console.groupEnd();
    }
  }

  /**
   * レスポンスのログ出力
   */
  logResponse(method, url, response, duration) {
    if (ENV.enableLogs || ENV.isDevelopment) {
      const emoji = response.success ? '✅' : '❌';
      console.group(`${emoji} API Response: ${method} ${url} (${duration}ms)`);
      console.log('Response:', response);
      console.groupEnd();
    }
  }

  /**
   * HTTPリクエストを実行
   */
  async request(method, endpoint, options = {}) {
    const {
      params = {},
      data = null,
      headers: customHeaders = {},
      retry = this.retry.maxRetries,
      signal = null,
    } = options;

    const url = this.buildUrl(endpoint, params);
    const headers = this.buildHeaders(customHeaders);

    // リクエストボディの準備
    let body = null;
    if (data) {
      if (data instanceof FormData) {
        body = data;
        delete headers['Content-Type']; // FormDataの場合、ブラウザが自動設定
      } else {
        body = JSON.stringify(data);
      }
    }

    // AbortControllerの作成
    const abortController = new AbortController();
    const requestId = `${method}_${endpoint}_${Date.now()}`;
    this.abortControllers.set(requestId, abortController);

    // タイムアウトの設定
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeout);

    const fetchOptions = {
      method,
      headers,
      body,
      signal: signal || abortController.signal,
      credentials: 'include', // Cookie送信を有効化
    };

    const startTime = Date.now();
    this.logRequest(method, url, fetchOptions);

    try {
      let lastError = null;

      // リトライループ
      for (let attempt = 0; attempt <= retry; attempt++) {
        try {
          const response = await fetch(url, fetchOptions);

          clearTimeout(timeoutId);
          this.abortControllers.delete(requestId);

          // 成功レスポンスの処理
          if (response.ok) {
            const data = await response.json();
            const result = {
              success: true,
              data: data.data || data,
              message: data.message || 'Success',
            };

            this.logResponse(method, url, result, Date.now() - startTime);
            return result;
          }

          // エラーレスポンスの処理
          const errorData = await this.handleErrorResponse(response);

          // トークン期限切れの場合、トークンを削除
          if (errorData.code === ERROR_CODES.TOKEN_EXPIRED ||
              errorData.code === ERROR_CODES.UNAUTHORIZED) {
            this.removeToken();

            // 自動的にログイン画面へリダイレクト（必要に応じて）
            if (typeof window !== 'undefined' && window.location) {
              // window.location.href = '/login';
            }
          }

          // リトライ可能なエラーの場合
          if (this.isRetryable(response.status) && attempt < retry) {
            await new Promise(resolve => setTimeout(resolve, this.retry.retryDelay * (attempt + 1)));
            continue;
          }

          this.logResponse(method, url, errorData, Date.now() - startTime);
          throw errorData;

        } catch (fetchError) {
          lastError = fetchError;

          // ネットワークエラーやタイムアウトの処理
          if (fetchError.name === 'AbortError') {
            lastError = {
              success: false,
              message: ERROR_MESSAGES[ERROR_CODES.TIMEOUT],
              code: ERROR_CODES.TIMEOUT,
            };
          } else if (fetchError.message === 'Failed to fetch' || !navigator.onLine) {
            lastError = {
              success: false,
              message: ERROR_MESSAGES[ERROR_CODES.NETWORK_ERROR],
              code: ERROR_CODES.NETWORK_ERROR,
            };
          }

          // 最後の試行でなければリトライ
          if (attempt < retry) {
            await new Promise(resolve => setTimeout(resolve, this.retry.retryDelay * (attempt + 1)));
            continue;
          }
        }
      }

      // すべてのリトライが失敗した場合
      this.logResponse(method, url, lastError, Date.now() - startTime);
      throw lastError;

    } finally {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * リクエストをキャンセル
   */
  cancelRequest(requestId) {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * すべてのリクエストをキャンセル
   */
  cancelAllRequests() {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  /**
   * GETリクエスト
   */
  async get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }

  /**
   * POSTリクエスト
   */
  async post(endpoint, data, options = {}) {
    return this.request('POST', endpoint, { ...options, data });
  }

  /**
   * PUTリクエスト
   */
  async put(endpoint, data, options = {}) {
    return this.request('PUT', endpoint, { ...options, data });
  }

  /**
   * PATCHリクエスト
   */
  async patch(endpoint, data, options = {}) {
    return this.request('PATCH', endpoint, { ...options, data });
  }

  /**
   * DELETEリクエスト
   */
  async delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, options);
  }

  /**
   * ファイルアップロード
   */
  async upload(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('file', file);

    // 追加データをFormDataに追加
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    return this.post(endpoint, formData, {
      headers: {
        // Content-Typeは自動設定されるので削除
      }
    });
  }
}

// シングルトンインスタンスをエクスポート
const apiClient = new APIClient();
export default apiClient;