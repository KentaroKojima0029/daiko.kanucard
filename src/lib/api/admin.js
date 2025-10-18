/**
 * 管理者API
 * 管理者専用のダッシュボード機能と申請管理機能を提供
 */

import apiClient from './apiClient.js';
import { API_ENDPOINTS, ERROR_CODES } from './config.js';

class AdminAPI {
  /**
   * 管理者権限の確認
   * @private
   * @returns {boolean} 管理者権限があるかどうか
   */
  checkAdminRole() {
    const user = apiClient.getUser();
    if (!user || user.role !== 'admin') {
      throw {
        success: false,
        message: '管理者権限が必要です',
        code: ERROR_CODES.FORBIDDEN,
      };
    }
    return true;
  }

  /**
   * ダッシュボード統計情報を取得
   * @returns {Promise<Object>} ダッシュボード統計データ
   */
  async getDashboard() {
    try {
      this.checkAdminRole();

      const response = await apiClient.get(API_ENDPOINTS.admin.dashboard);

      // レスポンスデータの整形
      if (response.success && response.data) {
        const dashboardData = {
          // 申請統計
          totalForms: response.data.totalForms || 0,
          pendingForms: response.data.pendingForms || 0,
          processingForms: response.data.processingForms || 0,
          completedForms: response.data.completedForms || 0,
          cancelledForms: response.data.cancelledForms || 0,

          // 今月の統計
          monthlyStats: {
            newForms: response.data.monthlyNewForms || 0,
            completedForms: response.data.monthlyCompletedForms || 0,
            revenue: response.data.monthlyRevenue || 0,
            growthRate: response.data.monthlyGrowthRate || 0,
          },

          // 最近の申請
          recentForms: response.data.recentForms || [],

          // 顧客統計
          totalCustomers: response.data.totalCustomers || 0,
          activeCustomers: response.data.activeCustomers || 0,
          newCustomersThisMonth: response.data.newCustomersThisMonth || 0,

          // パフォーマンス指標
          averageProcessingTime: response.data.averageProcessingTime || 0,
          customerSatisfactionRate: response.data.customerSatisfactionRate || 0,
        };

        return {
          ...response,
          data: dashboardData,
        };
      }

      return response;
    } catch (error) {
      console.error('Get dashboard error:', error);
      throw error;
    }
  }

  /**
   * 全申請一覧を取得（管理者用）
   * @param {Object} options - フィルターオプション
   * @param {string} [options.status] - ステータスでフィルタリング
   * @param {number} [options.page=1] - ページ番号
   * @param {number} [options.limit=20] - 1ページあたりの件数
   * @param {string} [options.search] - 検索キーワード
   * @param {string} [options.dateFrom] - 開始日
   * @param {string} [options.dateTo] - 終了日
   * @param {string} [options.customerId] - 顧客IDでフィルタリング
   * @param {string} [options.sortBy='createdAt'] - ソート項目
   * @param {string} [options.sortOrder='desc'] - ソート順
   * @returns {Promise<Object>} 申請一覧
   */
  async getForms(options = {}) {
    try {
      this.checkAdminRole();

      const params = {
        status: options.status,
        page: options.page || 1,
        limit: options.limit || 20,
        search: options.search,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        customerId: options.customerId,
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'desc',
      };

      // 未定義の値を削除
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === null || params[key] === '') {
          delete params[key];
        }
      });

      const response = await apiClient.get(API_ENDPOINTS.admin.forms, { params });

      return response;
    } catch (error) {
      console.error('Get forms error:', error);
      throw error;
    }
  }

  /**
   * 申請詳細を取得（管理者用）
   * @param {string} id - 申請ID
   * @returns {Promise<Object>} 申請詳細情報
   */
  async getFormById(id) {
    try {
      this.checkAdminRole();

      if (!id) {
        throw {
          success: false,
          message: '申請IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.admin.formDetail.replace('{id}', id);
      const response = await apiClient.get(endpoint);

      return response;
    } catch (error) {
      console.error('Get form detail error:', error);
      throw error;
    }
  }

  /**
   * 申請ステータスを更新
   * @param {string} id - 申請ID
   * @param {string} status - 新しいステータス
   * @param {Object} [additionalData] - 追加データ（メモなど）
   * @returns {Promise<Object>} 更新結果
   */
  async updateFormStatus(id, status, additionalData = {}) {
    try {
      this.checkAdminRole();

      if (!id || !status) {
        throw {
          success: false,
          message: '申請IDとステータスを指定してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      // 有効なステータスかチェック
      const validStatuses = ['pending', 'processing', 'shipped', 'grading', 'completed', 'cancelled', 'rejected'];
      if (!validStatuses.includes(status)) {
        throw {
          success: false,
          message: '無効なステータスです',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.admin.formUpdate.replace('{id}', id);
      const updateData = {
        status,
        ...additionalData,
        updatedBy: apiClient.getUser()?.id,
        updatedAt: new Date().toISOString(),
      };

      const response = await apiClient.put(endpoint, updateData);

      return response;
    } catch (error) {
      console.error('Update form status error:', error);
      throw error;
    }
  }

  /**
   * 申請情報を更新
   * @param {string} id - 申請ID
   * @param {Object} data - 更新データ
   * @returns {Promise<Object>} 更新結果
   */
  async updateForm(id, data) {
    try {
      this.checkAdminRole();

      if (!id) {
        throw {
          success: false,
          message: '申請IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.admin.formUpdate.replace('{id}', id);
      const updateData = {
        ...data,
        updatedBy: apiClient.getUser()?.id,
        updatedAt: new Date().toISOString(),
      };

      const response = await apiClient.put(endpoint, updateData);

      return response;
    } catch (error) {
      console.error('Update form error:', error);
      throw error;
    }
  }

  /**
   * 申請を削除
   * @param {string} id - 申請ID
   * @returns {Promise<Object>} 削除結果
   */
  async deleteForm(id) {
    try {
      this.checkAdminRole();

      if (!id) {
        throw {
          success: false,
          message: '申請IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.admin.formDelete.replace('{id}', id);
      const response = await apiClient.delete(endpoint);

      return response;
    } catch (error) {
      console.error('Delete form error:', error);
      throw error;
    }
  }

  /**
   * 申請にメモを追加
   * @param {string} formId - 申請ID
   * @param {string} note - メモ内容
   * @param {string} [type='general'] - メモタイプ
   * @returns {Promise<Object>} 追加結果
   */
  async addNote(formId, note, type = 'general') {
    try {
      this.checkAdminRole();

      if (!formId || !note) {
        throw {
          success: false,
          message: '申請IDとメモ内容を入力してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.admin.formNotes.replace('{id}', formId);
      const noteData = {
        content: note,
        type,
        createdBy: apiClient.getUser()?.id,
        createdByName: apiClient.getUser()?.name,
        createdAt: new Date().toISOString(),
      };

      const response = await apiClient.post(endpoint, noteData);

      return response;
    } catch (error) {
      console.error('Add note error:', error);
      throw error;
    }
  }

  /**
   * 顧客一覧を取得
   * @param {Object} options - フィルターオプション
   * @returns {Promise<Object>} 顧客一覧
   */
  async getCustomers(options = {}) {
    try {
      this.checkAdminRole();

      const params = {
        page: options.page || 1,
        limit: options.limit || 20,
        search: options.search,
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'desc',
      };

      // 未定義の値を削除
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === null || params[key] === '') {
          delete params[key];
        }
      });

      const response = await apiClient.get(API_ENDPOINTS.admin.customers, { params });

      return response;
    } catch (error) {
      console.error('Get customers error:', error);
      throw error;
    }
  }

  /**
   * 顧客詳細情報を取得
   * @param {string} customerId - 顧客ID
   * @returns {Promise<Object>} 顧客詳細情報
   */
  async getCustomerDetail(customerId) {
    try {
      this.checkAdminRole();

      if (!customerId) {
        throw {
          success: false,
          message: '顧客IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.admin.customerDetail.replace('{id}', customerId);
      const response = await apiClient.get(endpoint);

      return response;
    } catch (error) {
      console.error('Get customer detail error:', error);
      throw error;
    }
  }

  /**
   * 顧客別の申請一覧を取得
   * @param {string} customerId - 顧客ID
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 申請一覧
   */
  async getCustomerForms(customerId, options = {}) {
    try {
      this.checkAdminRole();

      if (!customerId) {
        throw {
          success: false,
          message: '顧客IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.admin.customerForms.replace('{id}', customerId);
      const params = {
        page: options.page || 1,
        limit: options.limit || 10,
        status: options.status,
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'desc',
      };

      // 未定義の値を削除
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === null) {
          delete params[key];
        }
      });

      const response = await apiClient.get(endpoint, { params });

      return response;
    } catch (error) {
      console.error('Get customer forms error:', error);
      throw error;
    }
  }

  /**
   * 申請データをCSVエクスポート
   * @param {Object} filters - エクスポートフィルター
   * @returns {Promise<Blob>} CSVファイルのBlob
   */
  async exportForms(filters = {}) {
    try {
      this.checkAdminRole();

      const params = {
        format: 'csv',
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        customerId: filters.customerId,
      };

      // 未定義の値を削除
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === null || params[key] === '') {
          delete params[key];
        }
      });

      // CSVダウンロード用のヘッダーを設定
      const response = await apiClient.get(API_ENDPOINTS.admin.export, {
        params,
        headers: {
          Accept: 'text/csv',
        },
        responseType: 'blob',
      });

      if (response.success) {
        // ファイル名の生成
        const now = new Date();
        const fileName = `forms_export_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`;

        // ダウンロードリンクの作成
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        window.URL.revokeObjectURL(url);

        return {
          success: true,
          message: 'エクスポートが完了しました',
        };
      }

      return response;
    } catch (error) {
      console.error('Export forms error:', error);
      throw error;
    }
  }

  /**
   * 申請に関するメッセージを送信（管理者から顧客へ）
   * @param {Object} messageData - メッセージデータ
   * @returns {Promise<Object>} 送信結果
   */
  async sendMessage(messageData) {
    try {
      this.checkAdminRole();

      if (!messageData.formId || !messageData.content) {
        throw {
          success: false,
          message: '申請IDとメッセージ内容を入力してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.admin.sendMessage;
      const data = {
        formId: messageData.formId,
        content: messageData.content,
        fromAdmin: true,
        adminId: apiClient.getUser()?.id,
        adminName: apiClient.getUser()?.name,
      };

      const response = await apiClient.post(endpoint, data);

      return response;
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }

  /**
   * システム設定を取得
   * @returns {Promise<Object>} システム設定
   */
  async getSystemSettings() {
    try {
      this.checkAdminRole();

      const response = await apiClient.get(API_ENDPOINTS.admin.settings);

      return response;
    } catch (error) {
      console.error('Get system settings error:', error);
      throw error;
    }
  }

  /**
   * システム設定を更新
   * @param {Object} settings - 更新する設定
   * @returns {Promise<Object>} 更新結果
   */
  async updateSystemSettings(settings) {
    try {
      this.checkAdminRole();

      const response = await apiClient.put(API_ENDPOINTS.admin.settings, settings);

      return response;
    } catch (error) {
      console.error('Update system settings error:', error);
      throw error;
    }
  }

  /**
   * 統計レポートを生成
   * @param {Object} options - レポートオプション
   * @returns {Promise<Object>} レポートデータ
   */
  async generateReport(options = {}) {
    try {
      this.checkAdminRole();

      const params = {
        type: options.type || 'monthly', // monthly, weekly, yearly
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        includeDetails: options.includeDetails !== false,
      };

      const response = await apiClient.get(API_ENDPOINTS.admin.reports, { params });

      return response;
    } catch (error) {
      console.error('Generate report error:', error);
      throw error;
    }
  }

  /**
   * 管理者ユーザー一覧を取得
   * @returns {Promise<Object>} 管理者ユーザー一覧
   */
  async getAdminUsers() {
    try {
      this.checkAdminRole();

      const response = await apiClient.get(API_ENDPOINTS.admin.users);

      return response;
    } catch (error) {
      console.error('Get admin users error:', error);
      throw error;
    }
  }

  /**
   * 管理者ユーザーを追加
   * @param {Object} userData - ユーザー情報
   * @returns {Promise<Object>} 追加結果
   */
  async addAdminUser(userData) {
    try {
      this.checkAdminRole();

      if (!userData.email || !userData.name || !userData.password) {
        throw {
          success: false,
          message: '必須項目を入力してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const response = await apiClient.post(API_ENDPOINTS.admin.users, {
        ...userData,
        role: 'admin',
      });

      return response;
    } catch (error) {
      console.error('Add admin user error:', error);
      throw error;
    }
  }

  /**
   * 管理者ユーザーを更新
   * @param {string} userId - ユーザーID
   * @param {Object} userData - 更新データ
   * @returns {Promise<Object>} 更新結果
   */
  async updateAdminUser(userId, userData) {
    try {
      this.checkAdminRole();

      if (!userId) {
        throw {
          success: false,
          message: 'ユーザーIDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.admin.userUpdate.replace('{id}', userId);
      const response = await apiClient.put(endpoint, userData);

      return response;
    } catch (error) {
      console.error('Update admin user error:', error);
      throw error;
    }
  }

  /**
   * 管理者ユーザーを削除
   * @param {string} userId - ユーザーID
   * @returns {Promise<Object>} 削除結果
   */
  async deleteAdminUser(userId) {
    try {
      this.checkAdminRole();

      if (!userId) {
        throw {
          success: false,
          message: 'ユーザーIDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      // 自分自身は削除できない
      const currentUser = apiClient.getUser();
      if (currentUser?.id === userId) {
        throw {
          success: false,
          message: '自分自身を削除することはできません',
          code: ERROR_CODES.FORBIDDEN,
        };
      }

      const endpoint = API_ENDPOINTS.admin.userDelete.replace('{id}', userId);
      const response = await apiClient.delete(endpoint);

      return response;
    } catch (error) {
      console.error('Delete admin user error:', error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
const adminAPI = new AdminAPI();
export default adminAPI;