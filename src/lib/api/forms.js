/**
 * フォームAPI
 * PSA鑑定代行申し込みフォームの送信と管理機能を提供
 */

import apiClient from './apiClient.js';
import { API_ENDPOINTS, ERROR_CODES, PLANS } from './config.js';

class FormsAPI {
  /**
   * フォームを送信
   * @param {Object} formData - フォームデータ
   * @returns {Promise<Object>} 送信結果
   */
  async submitForm(formData) {
    try {
      // 入力値の検証
      this.validateFormData(formData);

      // 料金計算
      const totalFee = this.calculateTotalFee(formData);

      // 送信データの整形
      const submitData = {
        customer: {
          name: formData.customer.name,
          email: formData.customer.email,
          phone: formData.customer.phone || '',
          company: formData.customer.company || '',
          address: formData.customer.address || '',
        },
        service: {
          psaPlan: formData.service.psaPlan,
          agentPlan: formData.service.agentPlan,
          purchaseOffer: formData.service.purchaseOffer,
          returnMethod: formData.service.returnMethod,
          inspection: formData.service.inspection,
          expressShipping: formData.service.expressShipping || false,
          insurance: formData.service.insurance || false,
        },
        cards: formData.cards.map(card => ({
          cardName: card.cardName,
          quantity: parseInt(card.quantity),
          declaredValue: parseFloat(card.declaredValue),
          acquisitionValue: card.acquisitionValue ? parseFloat(card.acquisitionValue) : null,
          notes: card.notes || '',
        })),
        totalFee: totalFee,
        estimatedCards: formData.cards.reduce((sum, card) => sum + parseInt(card.quantity), 0),
        message: formData.message || '',
        agreements: {
          terms: formData.agreements?.terms !== false,
          privacy: formData.agreements?.privacy !== false,
        },
        submittedAt: new Date().toISOString(),
      };

      // フォーム送信
      const response = await apiClient.post(API_ENDPOINTS.forms.submit, submitData);

      return response;
    } catch (error) {
      console.error('Form submission error:', error);
      throw error;
    }
  }

  /**
   * 自分の申請履歴を取得
   * @param {Object} options - オプション
   * @param {number} [options.page=1] - ページ番号
   * @param {number} [options.limit=10] - 1ページあたりの件数
   * @param {string} [options.status] - ステータスでフィルタリング
   * @param {string} [options.sortBy='createdAt'] - ソート項目
   * @param {string} [options.sortOrder='desc'] - ソート順
   * @returns {Promise<Object>} 申請履歴一覧
   */
  async getMyForms(options = {}) {
    try {
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

      const response = await apiClient.get(API_ENDPOINTS.forms.list, { params });

      return response;
    } catch (error) {
      console.error('Get my forms error:', error);
      throw error;
    }
  }

  /**
   * 申請の詳細を取得
   * @param {string} id - 申請ID
   * @returns {Promise<Object>} 申請詳細情報
   */
  async getMyForm(id) {
    try {
      if (!id) {
        throw {
          success: false,
          message: '申請IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.forms.detail.replace('{id}', id);
      const response = await apiClient.get(endpoint);

      return response;
    } catch (error) {
      console.error('Get form detail error:', error);
      throw error;
    }
  }

  /**
   * 申請をキャンセル
   * @param {string} id - 申請ID
   * @param {string} reason - キャンセル理由
   * @returns {Promise<Object>} キャンセル結果
   */
  async cancelForm(id, reason = '') {
    try {
      if (!id) {
        throw {
          success: false,
          message: '申請IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.forms.cancel.replace('{id}', id);
      const response = await apiClient.post(endpoint, { reason });

      return response;
    } catch (error) {
      console.error('Cancel form error:', error);
      throw error;
    }
  }

  /**
   * 申請を更新（修正）
   * @param {string} id - 申請ID
   * @param {Object} updateData - 更新データ
   * @returns {Promise<Object>} 更新結果
   */
  async updateForm(id, updateData) {
    try {
      if (!id) {
        throw {
          success: false,
          message: '申請IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.forms.update.replace('{id}', id);
      const response = await apiClient.patch(endpoint, updateData);

      return response;
    } catch (error) {
      console.error('Update form error:', error);
      throw error;
    }
  }

  /**
   * 問い合わせメッセージを送信
   * @param {Object} messageData - メッセージデータ
   * @param {string} messageData.formId - 申請ID
   * @param {string} messageData.content - メッセージ内容
   * @param {Array<File>} [messageData.attachments] - 添付ファイル
   * @returns {Promise<Object>} 送信結果
   */
  async sendMessage(messageData) {
    try {
      if (!messageData.formId || !messageData.content) {
        throw {
          success: false,
          message: '申請IDとメッセージ内容を入力してください',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      // 添付ファイルがある場合はFormDataを使用
      if (messageData.attachments && messageData.attachments.length > 0) {
        const formData = new FormData();
        formData.append('formId', messageData.formId);
        formData.append('content', messageData.content);

        messageData.attachments.forEach((file, index) => {
          formData.append(`attachments`, file);
        });

        return await apiClient.post(API_ENDPOINTS.messages.send, formData);
      }

      // 添付ファイルがない場合は通常のJSON送信
      const response = await apiClient.post(API_ENDPOINTS.messages.send, {
        formId: messageData.formId,
        content: messageData.content,
      });

      return response;
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }

  /**
   * メッセージ履歴を取得
   * @param {Object} options - オプション
   * @param {string} [options.formId] - 特定の申請のメッセージのみ取得
   * @param {number} [options.page=1] - ページ番号
   * @param {number} [options.limit=20] - 1ページあたりの件数
   * @returns {Promise<Object>} メッセージ一覧
   */
  async getMessages(options = {}) {
    try {
      // 特定の申請のメッセージを取得
      if (options.formId) {
        const endpoint = API_ENDPOINTS.messages.byForm.replace('{formId}', options.formId);
        return await apiClient.get(endpoint, {
          params: {
            page: options.page || 1,
            limit: options.limit || 20,
          }
        });
      }

      // すべてのメッセージを取得
      const response = await apiClient.get(API_ENDPOINTS.messages.list, {
        params: {
          page: options.page || 1,
          limit: options.limit || 20,
        }
      });

      return response;
    } catch (error) {
      console.error('Get messages error:', error);
      throw error;
    }
  }

  /**
   * メッセージを既読にする
   * @param {string} messageId - メッセージID
   * @returns {Promise<Object>} 更新結果
   */
  async markMessageAsRead(messageId) {
    try {
      if (!messageId) {
        throw {
          success: false,
          message: 'メッセージIDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR,
        };
      }

      const endpoint = API_ENDPOINTS.messages.read.replace('{id}', messageId);
      const response = await apiClient.patch(endpoint);

      return response;
    } catch (error) {
      console.error('Mark message as read error:', error);
      throw error;
    }
  }

  /**
   * フォームデータの検証
   * @private
   */
  validateFormData(formData) {
    const errors = [];

    // 顧客情報の検証
    if (!formData.customer) {
      errors.push('顧客情報が入力されていません');
    } else {
      if (!formData.customer.name) errors.push('お名前を入力してください');
      if (!formData.customer.email) errors.push('メールアドレスを入力してください');

      // メールアドレスの形式チェック
      if (formData.customer.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.customer.email)) {
          errors.push('メールアドレスの形式が正しくありません');
        }
      }
    }

    // サービス情報の検証
    if (!formData.service) {
      errors.push('サービス情報が選択されていません');
    } else {
      if (!formData.service.psaPlan) errors.push('PSAプランを選択してください');
      if (!formData.service.agentPlan) errors.push('代行プランを選択してください');
      if (!formData.service.returnMethod) errors.push('返却方法を選択してください');

      // プランの有効性チェック
      if (formData.service.psaPlan && !Object.values(PLANS.psa).some(plan => plan.value === formData.service.psaPlan)) {
        errors.push('無効なPSAプランが選択されています');
      }
      if (formData.service.agentPlan && !Object.values(PLANS.agent).some(plan => plan.value === formData.service.agentPlan)) {
        errors.push('無効な代行プランが選択されています');
      }
    }

    // カード情報の検証
    if (!formData.cards || formData.cards.length === 0) {
      errors.push('カード情報を1枚以上入力してください');
    } else {
      formData.cards.forEach((card, index) => {
        if (!card.cardName) errors.push(`カード${index + 1}の名前を入力してください`);
        if (!card.quantity || card.quantity <= 0) errors.push(`カード${index + 1}の枚数を正しく入力してください`);
        if (!card.declaredValue || card.declaredValue <= 0) errors.push(`カード${index + 1}の申告価格を正しく入力してください`);

        // 最大値チェック
        if (card.quantity > 100) errors.push(`カード${index + 1}の枚数は100枚以下で入力してください`);
        if (card.declaredValue > 10000000) errors.push(`カード${index + 1}の申告価格は1000万円以下で入力してください`);
      });
    }

    // エラーがある場合は例外をスロー
    if (errors.length > 0) {
      throw {
        success: false,
        message: errors.join('\n'),
        code: ERROR_CODES.VALIDATION_ERROR,
        errors: errors,
      };
    }
  }

  /**
   * 料金を計算
   * @private
   */
  calculateTotalFee(formData) {
    let totalFee = 0;

    // 基本料金（プランに応じて）
    const psaPlanFees = {
      economy: 2000,
      value: 3500,
      regular: 5000,
      express: 8000,
    };

    const agentPlanFees = {
      basic: 1000,
      standard: 2000,
      premium: 3500,
    };

    if (formData.service) {
      totalFee += psaPlanFees[formData.service.psaPlan] || 0;
      totalFee += agentPlanFees[formData.service.agentPlan] || 0;
    }

    // カード枚数に応じた追加料金
    if (formData.cards) {
      const totalCards = formData.cards.reduce((sum, card) => sum + parseInt(card.quantity || 0), 0);
      if (totalCards > 10) {
        totalFee += (totalCards - 10) * 100; // 10枚を超える場合、1枚につき100円追加
      }
    }

    // オプション料金
    if (formData.service) {
      if (formData.service.expressShipping) totalFee += 1500;
      if (formData.service.insurance) totalFee += 800;
      if (formData.service.inspection === 'detailed') totalFee += 2000;
    }

    return totalFee;
  }

  /**
   * フォームのステータスを日本語に変換
   * @param {string} status - ステータス
   * @returns {string} 日本語のステータス
   */
  getStatusLabel(status) {
    const statusLabels = {
      draft: '下書き',
      submitted: '申請済み',
      processing: '処理中',
      shipped: '発送済み',
      grading: '鑑定中',
      completed: '完了',
      cancelled: 'キャンセル済み',
      rejected: '却下',
    };

    return statusLabels[status] || status;
  }

  /**
   * フォームのステータスカラーを取得
   * @param {string} status - ステータス
   * @returns {string} カラーコード
   */
  getStatusColor(status) {
    const statusColors = {
      draft: '#6c757d',       // グレー
      submitted: '#007bff',    // 青
      processing: '#17a2b8',   // シアン
      shipped: '#fd7e14',      // オレンジ
      grading: '#ffc107',      // イエロー
      completed: '#28a745',    // 緑
      cancelled: '#6c757d',    // グレー
      rejected: '#dc3545',     // 赤
    };

    return statusColors[status] || '#6c757d';
  }
}

// シングルトンインスタンスをエクスポート
const formsAPI = new FormsAPI();
export default formsAPI;