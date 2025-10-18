/**
 * 認証API
 * ユーザー登録、ログイン、ログアウトなどの認証関連機能を提供
 */

import apiClient from './apiClient.js';
import { API_ENDPOINTS, ERROR_CODES } from './config.js';

class AuthAPI {
  /**
   * ユーザー登録
   * @param {Object} userData - ユーザー情報
   * @param {string} userData.email - メールアドレス
   * @param {string} userData.password - パスワード
   * @param {string} userData.name - 名前
   * @param {string} [userData.phone] - 電話番号（任意）
   * @param {string} [userData.company] - 会社名（任意）
   * @returns {Promise<Object>} 登録結果とユーザー情報
   */
  async register(userData) {
    try {
      // 入力値の検証
      if (!userData.email || !userData.password || !userData.name) {
        throw {
          success: false,
          message: '必須項目を入力してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      // メールアドレスの形式チェック
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        throw {
          success: false,
          message: 'メールアドレスの形式が正しくありません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      // パスワードの強度チェック（最低8文字）
      if (userData.password.length < 8) {
        throw {
          success: false,
          message: 'パスワードは8文字以上で設定してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const response = await apiClient.post(API_ENDPOINTS.auth.register, userData);

      // 登録成功時、トークンとユーザー情報を保存
      if (response.success && response.data) {
        const { token, refreshToken, user } = response.data;
        if (token) {
          apiClient.setToken(token, refreshToken);
        }
        if (user) {
          apiClient.setUser(user);
        }
      }

      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * ログイン
   * @param {string} email - メールアドレス
   * @param {string} password - パスワード
   * @param {boolean} [rememberMe=false] - ログイン状態を保持するか
   * @returns {Promise<Object>} ログイン結果とユーザー情報
   */
  async login(email, password, rememberMe = false) {
    try {
      // 入力値の検証
      if (!email || !password) {
        throw {
          success: false,
          message: 'メールアドレスとパスワードを入力してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const response = await apiClient.post(API_ENDPOINTS.auth.login, {
        email,
        password,
        rememberMe,
      });

      // ログイン成功時、トークンとユーザー情報を保存
      if (response.success && response.data) {
        const { token, refreshToken, user } = response.data;
        if (token) {
          apiClient.setToken(token, refreshToken);
        }
        if (user) {
          apiClient.setUser(user);
        }
      }

      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * ログアウト
   * @returns {Promise<Object>} ログアウト結果
   */
  async logout() {
    try {
      // サーバー側のログアウト処理を呼び出し（セッション削除など）
      const response = await apiClient.post(API_ENDPOINTS.auth.logout);

      // ローカルのトークンとユーザー情報を削除
      apiClient.removeToken();

      // すべてのリクエストをキャンセル
      apiClient.cancelAllRequests();

      return response;
    } catch (error) {
      // エラーが発生してもローカルのトークンは削除
      apiClient.removeToken();
      apiClient.cancelAllRequests();

      // ネットワークエラーの場合でも成功として扱う
      if (error.code === ERROR_CODES.NETWORK_ERROR) {
        return { success: true, message: 'ログアウトしました' };
      }

      throw error;
    }
  }

  /**
   * 現在のユーザー情報を取得
   * @param {boolean} [forceRefresh=false] - 強制的にサーバーから取得するか
   * @returns {Promise<Object>} ユーザー情報
   */
  async getCurrentUser(forceRefresh = false) {
    try {
      // キャッシュからユーザー情報を取得
      if (!forceRefresh) {
        const cachedUser = apiClient.getUser();
        if (cachedUser) {
          return {
            success: true,
            data: cachedUser,
          };
        }
      }

      // トークンがない場合はエラー
      if (!apiClient.getToken()) {
        throw {
          success: false,
          message: 'ログインが必要です',
          code: ERROR_CODES.UNAUTHORIZED,
        };
      }

      // サーバーから最新のユーザー情報を取得
      const response = await apiClient.get(API_ENDPOINTS.auth.me);

      // 取得成功時、ユーザー情報を保存
      if (response.success && response.data) {
        apiClient.setUser(response.data);
      }

      return response;
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

  /**
   * トークンの有効性を確認
   * @returns {Promise<boolean>} トークンが有効かどうか
   */
  async isAuthenticated() {
    try {
      const token = apiClient.getToken();
      if (!token) {
        return false;
      }

      // トークンの有効性を確認（有効期限チェックなど）
      const response = await apiClient.get(API_ENDPOINTS.auth.me);
      return response.success === true;
    } catch (error) {
      // エラーが発生した場合は未認証として扱う
      return false;
    }
  }

  /**
   * 管理者権限を確認
   * @returns {Promise<boolean>} 管理者権限があるかどうか
   */
  async isAdmin() {
    try {
      // ローカルのユーザー情報から確認
      const user = apiClient.getUser();
      if (!user) {
        return false;
      }

      // 管理者権限の確認
      if (user.role === 'admin') {
        // サーバーに最新の権限を確認（オプション）
        try {
          const response = await this.getCurrentUser(true);
          if (response.success && response.data) {
            return response.data.role === 'admin';
          }
        } catch (error) {
          // エラーが発生してもローカル情報を信用
          return user.role === 'admin';
        }
      }

      return false;
    } catch (error) {
      console.error('Admin check error:', error);
      return false;
    }
  }

  /**
   * トークンをリフレッシュ
   * @returns {Promise<Object>} 新しいトークン
   */
  async refreshToken() {
    try {
      const refreshToken = apiClient.getRefreshToken();
      if (!refreshToken) {
        throw {
          success: false,
          message: 'リフレッシュトークンがありません',
          code: ERROR_CODES.UNAUTHORIZED,
        };
      }

      const response = await apiClient.post(API_ENDPOINTS.auth.refresh, {
        refreshToken,
      });

      // 新しいトークンを保存
      if (response.success && response.data) {
        const { token, refreshToken: newRefreshToken } = response.data;
        apiClient.setToken(token, newRefreshToken || refreshToken);
      }

      return response;
    } catch (error) {
      console.error('Token refresh error:', error);
      // リフレッシュに失敗した場合はログアウト
      apiClient.removeToken();
      throw error;
    }
  }

  /**
   * パスワードリセット要求
   * @param {string} email - メールアドレス
   * @returns {Promise<Object>} リセット要求結果
   */
  async forgotPassword(email) {
    try {
      if (!email) {
        throw {
          success: false,
          message: 'メールアドレスを入力してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const response = await apiClient.post(API_ENDPOINTS.auth.forgotPassword, {
        email,
      });

      return response;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  /**
   * パスワードリセット
   * @param {string} token - リセットトークン
   * @param {string} newPassword - 新しいパスワード
   * @returns {Promise<Object>} リセット結果
   */
  async resetPassword(token, newPassword) {
    try {
      if (!token || !newPassword) {
        throw {
          success: false,
          message: '必須項目を入力してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      // パスワードの強度チェック
      if (newPassword.length < 8) {
        throw {
          success: false,
          message: 'パスワードは8文字以上で設定してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const response = await apiClient.post(API_ENDPOINTS.auth.resetPassword, {
        token,
        newPassword,
      });

      return response;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  /**
   * メールアドレス確認
   * @param {string} token - 確認トークン
   * @returns {Promise<Object>} 確認結果
   */
  async verifyEmail(token) {
    try {
      if (!token) {
        throw {
          success: false,
          message: '確認トークンがありません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const response = await apiClient.post(API_ENDPOINTS.auth.verifyEmail, {
        token,
      });

      return response;
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * パスワード変更
   * @param {string} currentPassword - 現在のパスワード
   * @param {string} newPassword - 新しいパスワード
   * @returns {Promise<Object>} 変更結果
   */
  async changePassword(currentPassword, newPassword) {
    try {
      if (!currentPassword || !newPassword) {
        throw {
          success: false,
          message: '現在のパスワードと新しいパスワードを入力してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      // パスワードの強度チェック
      if (newPassword.length < 8) {
        throw {
          success: false,
          message: '新しいパスワードは8文字以上で設定してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      // 同じパスワードでないことを確認
      if (currentPassword === newPassword) {
        throw {
          success: false,
          message: '新しいパスワードは現在のパスワードと異なるものを設定してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const response = await apiClient.patch('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });

      return response;
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * アカウント削除
   * @param {string} password - パスワード（確認用）
   * @returns {Promise<Object>} 削除結果
   */
  async deleteAccount(password) {
    try {
      if (!password) {
        throw {
          success: false,
          message: 'パスワードを入力してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const response = await apiClient.delete('/api/auth/account', {
        data: { password },
      });

      // アカウント削除成功時、ローカルデータを削除
      if (response.success) {
        apiClient.removeToken();
      }

      return response;
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
const authAPI = new AuthAPI();
export default authAPI;