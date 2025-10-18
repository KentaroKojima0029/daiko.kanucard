/**
 * 申請履歴コンポーネントの例
 * ユーザーの申請履歴の表示と管理機能の実装例
 */

import React, { useState, useEffect } from 'react';
import api from '../../lib/api';

const MyForms = () => {
  // 状態管理
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // フィルタとページネーション
  const [filter, setFilter] = useState({
    status: '',
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // メッセージ送信用
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  // コンポーネントマウント時に申請履歴を取得
  useEffect(() => {
    fetchMyForms();
  }, [filter]);

  // 申請履歴を取得
  const fetchMyForms = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.forms.getMyForms(filter);

      if (result.success && result.data) {
        setForms(result.data.items || result.data);
        setTotalPages(result.data.totalPages || 1);
        setTotalCount(result.data.totalCount || result.data.length);
      }
    } catch (err) {
      console.error('申請履歴取得エラー:', err);
      setError(api.utils.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 申請詳細を取得
  const fetchFormDetail = async (formId) => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.forms.getMyForm(formId);

      if (result.success && result.data) {
        setSelectedForm(result.data);
        await fetchMessages(formId);
      }
    } catch (err) {
      console.error('申請詳細取得エラー:', err);
      setError(api.utils.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // メッセージ履歴を取得
  const fetchMessages = async (formId) => {
    try {
      const result = await api.forms.getMessages({ formId });

      if (result.success && result.data) {
        setMessages(result.data.items || result.data);
      }
    } catch (err) {
      console.error('メッセージ取得エラー:', err);
    }
  };

  // 申請をキャンセル
  const handleCancelForm = async (formId) => {
    if (!window.confirm('この申請をキャンセルしますか？')) {
      return;
    }

    const reason = window.prompt('キャンセル理由を入力してください（任意）');

    setLoading(true);
    setError(null);

    try {
      await api.forms.cancelForm(formId, reason || '');
      alert('申請をキャンセルしました');

      // リストを更新
      fetchMyForms();
      setSelectedForm(null);
    } catch (err) {
      console.error('キャンセルエラー:', err);
      setError(api.utils.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // メッセージを送信
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim()) {
      alert('メッセージを入力してください');
      return;
    }

    if (!selectedForm) {
      alert('申請を選択してください');
      return;
    }

    setSendingMessage(true);
    setError(null);

    try {
      await api.forms.sendMessage({
        formId: selectedForm.id,
        content: newMessage,
        attachments: attachments,
      });

      alert('メッセージを送信しました');

      // メッセージをリセット
      setNewMessage('');
      setAttachments([]);

      // メッセージ履歴を更新
      await fetchMessages(selectedForm.id);
    } catch (err) {
      console.error('メッセージ送信エラー:', err);
      setError(api.utils.getErrorMessage(err));
    } finally {
      setSendingMessage(false);
    }
  };

  // ファイル選択処理
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(files);
  };

  // フィルタ変更
  const handleFilterChange = (key, value) => {
    setFilter(prev => ({
      ...prev,
      [key]: value,
      page: 1, // フィルタ変更時はページを1に戻す
    }));
  };

  // ページ変更
  const handlePageChange = (newPage) => {
    setFilter(prev => ({
      ...prev,
      page: newPage,
    }));
  };

  return (
    <div className="my-forms-container">
      <h2>申請履歴</h2>

      {/* フィルタセクション */}
      <div className="filter-section">
        <div className="filter-group">
          <label htmlFor="status-filter">ステータス:</label>
          <select
            id="status-filter"
            value={filter.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">すべて</option>
            <option value="submitted">申請済み</option>
            <option value="processing">処理中</option>
            <option value="shipped">発送済み</option>
            <option value="grading">鑑定中</option>
            <option value="completed">完了</option>
            <option value="cancelled">キャンセル済み</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="sort-filter">並び替え:</label>
          <select
            id="sort-filter"
            value={`${filter.sortBy}-${filter.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-');
              handleFilterChange('sortBy', sortBy);
              handleFilterChange('sortOrder', sortOrder);
            }}
          >
            <option value="createdAt-desc">新しい順</option>
            <option value="createdAt-asc">古い順</option>
            <option value="totalFee-desc">料金（高い順）</option>
            <option value="totalFee-asc">料金（安い順）</option>
          </select>
        </div>

        <button onClick={fetchMyForms} className="btn btn-secondary">
          更新
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* ローディング表示 */}
      {loading && (
        <div className="loading">読み込み中...</div>
      )}

      {/* 申請リスト */}
      {!loading && forms.length === 0 ? (
        <div className="empty-state">
          <p>申請履歴がありません</p>
          <button
            onClick={() => window.location.href = '/form'}
            className="btn btn-primary"
          >
            新規申請を作成
          </button>
        </div>
      ) : (
        <div className="forms-list">
          <table>
            <thead>
              <tr>
                <th>申請ID</th>
                <th>申請日</th>
                <th>ステータス</th>
                <th>カード枚数</th>
                <th>料金</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {forms.map(form => (
                <tr key={form.id}>
                  <td>{form.id}</td>
                  <td>{api.utils.formatDateTime(form.createdAt, false)}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: api.forms.getStatusColor(form.status)
                      }}
                    >
                      {api.forms.getStatusLabel(form.status)}
                    </span>
                  </td>
                  <td>{form.estimatedCards || 0}枚</td>
                  <td>{api.utils.formatCurrency(form.totalFee)}</td>
                  <td>
                    <button
                      onClick={() => fetchFormDetail(form.id)}
                      className="btn btn-small"
                    >
                      詳細
                    </button>
                    {form.status === 'submitted' && (
                      <button
                        onClick={() => handleCancelForm(form.id)}
                        className="btn btn-small btn-danger"
                      >
                        キャンセル
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(filter.page - 1)}
                disabled={filter.page === 1}
              >
                前へ
              </button>

              <span>
                {filter.page} / {totalPages} ページ （全{totalCount}件）
              </span>

              <button
                onClick={() => handlePageChange(filter.page + 1)}
                disabled={filter.page === totalPages}
              >
                次へ
              </button>
            </div>
          )}
        </div>
      )}

      {/* 申請詳細モーダル */}
      {selectedForm && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>申請詳細 (ID: {selectedForm.id})</h3>
              <button
                onClick={() => {
                  setSelectedForm(null);
                  setMessages([]);
                }}
                className="btn-close"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* 申請情報 */}
              <section className="form-detail">
                <h4>申請情報</h4>
                <dl>
                  <dt>申請日:</dt>
                  <dd>{api.utils.formatDateTime(selectedForm.createdAt)}</dd>

                  <dt>ステータス:</dt>
                  <dd>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: api.forms.getStatusColor(selectedForm.status)
                      }}
                    >
                      {api.forms.getStatusLabel(selectedForm.status)}
                    </span>
                  </dd>

                  <dt>プラン:</dt>
                  <dd>
                    PSA: {selectedForm.service?.psaPlan}<br />
                    代行: {selectedForm.service?.agentPlan}
                  </dd>

                  <dt>料金:</dt>
                  <dd>{api.utils.formatCurrency(selectedForm.totalFee)}</dd>
                </dl>
              </section>

              {/* カード情報 */}
              <section className="cards-detail">
                <h4>カード情報</h4>
                <table>
                  <thead>
                    <tr>
                      <th>カード名</th>
                      <th>枚数</th>
                      <th>申告価格</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedForm.cards?.map((card, index) => (
                      <tr key={index}>
                        <td>{card.cardName}</td>
                        <td>{card.quantity}枚</td>
                        <td>{api.utils.formatCurrency(card.declaredValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* メッセージ履歴 */}
              <section className="messages-section">
                <h4>メッセージ</h4>

                <div className="messages-list">
                  {messages.length === 0 ? (
                    <p>メッセージはありません</p>
                  ) : (
                    messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`message ${msg.sender === 'customer' ? 'sent' : 'received'}`}
                      >
                        <div className="message-header">
                          <span className="sender">
                            {msg.sender === 'customer' ? 'あなた' : 'サポート'}
                          </span>
                          <span className="time">
                            {api.utils.formatDateTime(msg.createdAt)}
                          </span>
                        </div>
                        <div className="message-content">
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* メッセージ送信フォーム */}
                {selectedForm.status !== 'completed' && selectedForm.status !== 'cancelled' && (
                  <form onSubmit={handleSendMessage} className="message-form">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="メッセージを入力..."
                      rows="3"
                      required
                    />

                    <div className="message-actions">
                      <input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx"
                      />

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={sendingMessage}
                      >
                        {sendingMessage ? '送信中...' : '送信'}
                      </button>
                    </div>

                    {attachments.length > 0 && (
                      <div className="attachments-preview">
                        添付ファイル: {attachments.map(f => f.name).join(', ')}
                      </div>
                    )}
                  </form>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyForms;