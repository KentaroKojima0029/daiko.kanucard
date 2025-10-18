/**
 * フォーム送信コンポーネントの例
 * PSA鑑定代行申し込みフォームの実装例
 */

import React, { useState } from 'react';
import api from '../../lib/api';

const FormSubmit = () => {
  // フォームデータの状態管理
  const [formData, setFormData] = useState({
    customer: {
      name: '',
      email: '',
      phone: '',
      company: '',
      address: '',
    },
    service: {
      psaPlan: 'regular',
      agentPlan: 'standard',
      purchaseOffer: 'no',
      returnMethod: 'pickup',
      inspection: 'basic',
      expressShipping: false,
      insurance: false,
    },
    cards: [
      {
        cardName: '',
        quantity: 1,
        declaredValue: 0,
        acquisitionValue: null,
        notes: '',
      },
    ],
    message: '',
    agreements: {
      terms: false,
      privacy: false,
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // 顧客情報の更新
  const handleCustomerChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      customer: {
        ...prev.customer,
        [field]: value,
      },
    }));
  };

  // サービス情報の更新
  const handleServiceChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      service: {
        ...prev.service,
        [field]: value,
      },
    }));
  };

  // カード情報の更新
  const handleCardChange = (index, field, value) => {
    setFormData(prev => {
      const newCards = [...prev.cards];
      newCards[index] = {
        ...newCards[index],
        [field]: value,
      };
      return {
        ...prev,
        cards: newCards,
      };
    });
  };

  // カードの追加
  const addCard = () => {
    setFormData(prev => ({
      ...prev,
      cards: [
        ...prev.cards,
        {
          cardName: '',
          quantity: 1,
          declaredValue: 0,
          acquisitionValue: null,
          notes: '',
        },
      ],
    }));
  };

  // カードの削除
  const removeCard = (index) => {
    setFormData(prev => ({
      ...prev,
      cards: prev.cards.filter((_, i) => i !== index),
    }));
  };

  // フォーム送信処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // 利用規約と個人情報保護方針への同意確認
      if (!formData.agreements.terms || !formData.agreements.privacy) {
        throw {
          message: '利用規約と個人情報保護方針に同意してください',
        };
      }

      // APIを使用してフォーム送信
      const result = await api.forms.submitForm(formData);

      console.log('送信成功:', result);
      setSuccess(true);

      // 成功メッセージを表示
      alert('申し込みが完了しました。確認メールをご確認ください。');

      // フォームをリセット（必要に応じて）
      // resetForm();

    } catch (err) {
      console.error('送信失敗:', err);
      setError(api.utils.getErrorMessage(err));
      alert(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-submit-container">
      <h2>PSA鑑定代行申し込みフォーム</h2>

      <form onSubmit={handleSubmit}>
        {/* 顧客情報セクション */}
        <section className="customer-section">
          <h3>お客様情報</h3>

          <div className="form-group">
            <label htmlFor="name">
              お名前 <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.customer.name}
              onChange={(e) => handleCustomerChange('name', e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              メールアドレス <span className="required">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={formData.customer.email}
              onChange={(e) => handleCustomerChange('email', e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">電話番号</label>
            <input
              type="tel"
              id="phone"
              value={formData.customer.phone}
              onChange={(e) => handleCustomerChange('phone', e.target.value)}
              placeholder="090-1234-5678"
            />
          </div>

          <div className="form-group">
            <label htmlFor="company">会社名（法人の場合）</label>
            <input
              type="text"
              id="company"
              value={formData.customer.company}
              onChange={(e) => handleCustomerChange('company', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">住所</label>
            <input
              type="text"
              id="address"
              value={formData.customer.address}
              onChange={(e) => handleCustomerChange('address', e.target.value)}
              placeholder="東京都渋谷区..."
            />
          </div>
        </section>

        {/* サービスプランセクション */}
        <section className="service-section">
          <h3>サービスプラン選択</h3>

          <div className="form-group">
            <label htmlFor="psaPlan">
              PSAグレーディングプラン <span className="required">*</span>
            </label>
            <select
              id="psaPlan"
              value={formData.service.psaPlan}
              onChange={(e) => handleServiceChange('psaPlan', e.target.value)}
              required
            >
              <option value="economy">エコノミー（約45営業日）</option>
              <option value="value">バリュー（約20営業日）</option>
              <option value="regular">レギュラー（約10営業日）</option>
              <option value="express">エクスプレス（約5営業日）</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="agentPlan">
              代行プラン <span className="required">*</span>
            </label>
            <select
              id="agentPlan"
              value={formData.service.agentPlan}
              onChange={(e) => handleServiceChange('agentPlan', e.target.value)}
              required
            >
              <option value="basic">基本プラン</option>
              <option value="standard">スタンダードプラン</option>
              <option value="premium">プレミアムプラン</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="purchaseOffer">買取オファー</label>
            <select
              id="purchaseOffer"
              value={formData.service.purchaseOffer}
              onChange={(e) => handleServiceChange('purchaseOffer', e.target.value)}
            >
              <option value="no">希望しない</option>
              <option value="yes">希望する</option>
              <option value="consider">検討する</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="returnMethod">返却方法</label>
            <select
              id="returnMethod"
              value={formData.service.returnMethod}
              onChange={(e) => handleServiceChange('returnMethod', e.target.value)}
            >
              <option value="pickup">店頭引き取り</option>
              <option value="shipping">配送</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.service.expressShipping}
                onChange={(e) => handleServiceChange('expressShipping', e.target.checked)}
              />
              速達配送を希望（+¥1,500）
            </label>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.service.insurance}
                onChange={(e) => handleServiceChange('insurance', e.target.checked)}
              />
              配送保険を希望（+¥800）
            </label>
          </div>
        </section>

        {/* カード情報セクション */}
        <section className="cards-section">
          <h3>鑑定カード情報</h3>

          {formData.cards.map((card, index) => (
            <div key={index} className="card-item">
              <h4>カード {index + 1}</h4>

              <div className="form-group">
                <label>
                  カード名 <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={card.cardName}
                  onChange={(e) => handleCardChange(index, 'cardName', e.target.value)}
                  placeholder="例: ピカチュウ VMAX"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  枚数 <span className="required">*</span>
                </label>
                <input
                  type="number"
                  value={card.quantity}
                  onChange={(e) => handleCardChange(index, 'quantity', e.target.value)}
                  min="1"
                  max="100"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  申告価格（円） <span className="required">*</span>
                </label>
                <input
                  type="number"
                  value={card.declaredValue}
                  onChange={(e) => handleCardChange(index, 'declaredValue', e.target.value)}
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>取得価格（円）</label>
                <input
                  type="number"
                  value={card.acquisitionValue || ''}
                  onChange={(e) => handleCardChange(index, 'acquisitionValue', e.target.value || null)}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>備考</label>
                <textarea
                  value={card.notes}
                  onChange={(e) => handleCardChange(index, 'notes', e.target.value)}
                  rows="2"
                  placeholder="特記事項があれば記入してください"
                />
              </div>

              {formData.cards.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCard(index)}
                  className="btn-remove"
                >
                  このカードを削除
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={addCard} className="btn-add">
            カードを追加
          </button>
        </section>

        {/* メッセージセクション */}
        <section className="message-section">
          <h3>ご要望・ご質問（任意）</h3>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
            rows="4"
            placeholder="ご要望やご質問があればこちらに記入してください"
          />
        </section>

        {/* 同意確認セクション */}
        <section className="agreements-section">
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.agreements.terms}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  agreements: {
                    ...prev.agreements,
                    terms: e.target.checked,
                  },
                }))}
                required
              />
              <a href="/terms" target="_blank">利用規約</a>に同意します <span className="required">*</span>
            </label>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.agreements.privacy}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  agreements: {
                    ...prev.agreements,
                    privacy: e.target.checked,
                  },
                }))}
                required
              />
              <a href="/privacy" target="_blank">個人情報保護方針</a>に同意します <span className="required">*</span>
            </label>
          </div>
        </section>

        {/* エラー表示 */}
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {/* 成功表示 */}
        {success && (
          <div className="alert alert-success">
            申し込みが完了しました
          </div>
        )}

        {/* 送信ボタン */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? '送信中...' : '申し込みを送信'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormSubmit;