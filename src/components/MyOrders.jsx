/**
 * マイページ - Shopify注文履歴表示コンポーネント
 * ログインユーザーの購入履歴を表示
 */

import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import './MyOrders.css';

const MyOrders = () => {
  // 状態管理
  const [orders, setOrders] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  // コンポーネントマウント時に注文履歴を取得
  useEffect(() => {
    fetchOrders();
  }, []);

  // 注文履歴を取得
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      // ローカルストレージからユーザー情報を取得
      const userDataStr = localStorage.getItem('kanucard_user_data');
      if (!userDataStr) {
        throw new Error('ログインが必要です');
      }

      const userData = JSON.parse(userDataStr);
      const email = userData.email;

      if (!email) {
        throw new Error('ユーザー情報が不完全です');
      }

      // APIエンドポイントから注文履歴を取得
      const response = await fetch(
        `http://localhost:3000/api/shopify/customer/${encodeURIComponent(email)}/orders`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('kanucard_auth_token')}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '注文履歴の取得に失敗しました');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '注文履歴の取得に失敗しました');
      }

      setCustomer(result.data.customer);
      setOrders(result.data.orders || []);

    } catch (err) {
      console.error('注文履歴取得エラー:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 注文カードの展開/折りたたみ
  const toggleOrderExpand = (orderNumber) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderNumber)) {
      newExpanded.delete(orderNumber);
    } else {
      newExpanded.add(orderNumber);
    }
    setExpandedOrders(newExpanded);
  };

  // 日付フォーマット
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // 価格フォーマット
  const formatPrice = (price) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(numPrice || 0);
  };

  // ステータスの日本語化
  const getStatusLabel = (status) => {
    const statusMap = {
      'PAID': '支払い済み',
      'REFUNDED': '返金済み',
      'PARTIALLY_REFUNDED': '一部返金',
      'PENDING': '保留中',
      'AUTHORIZED': '承認済み',
      'VOIDED': '無効',
      'FULFILLED': '配送済み',
      'UNFULFILLED': '未配送',
      'PARTIALLY_FULFILLED': '一部配送'
    };
    return statusMap[status] || status;
  };

  // ステータスのカラー
  const getStatusColor = (status) => {
    const colorMap = {
      'PAID': '#10b981',
      'REFUNDED': '#ef4444',
      'PARTIALLY_REFUNDED': '#f59e0b',
      'PENDING': '#6b7280',
      'AUTHORIZED': '#3b82f6',
      'VOIDED': '#6b7280',
      'FULFILLED': '#10b981',
      'UNFULFILLED': '#f59e0b',
      'PARTIALLY_FULFILLED': '#f59e0b'
    };
    return colorMap[status] || '#6b7280';
  };

  // ローディング表示
  if (loading) {
    return (
      <div className="my-orders-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>注文履歴を読み込み中...</p>
        </div>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="my-orders-container">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h2>エラーが発生しました</h2>
          <p>{error}</p>
          <button onClick={fetchOrders} className="retry-button">
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-orders-container">
      <div className="my-orders-header">
        <h1>マイページ</h1>
        <p className="subtitle">購入履歴・アカウント情報</p>
      </div>

      {/* 顧客情報サマリー */}
      {customer && (
        <div className="customer-summary">
          <div className="summary-card">
            <div className="summary-header">
              <h2>アカウント情報</h2>
            </div>
            <div className="summary-content">
              <div className="summary-item">
                <span className="label">お名前</span>
                <span className="value">
                  {customer.lastName || ''} {customer.firstName || 'ゲスト'}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">メールアドレス</span>
                <span className="value">{customer.email}</span>
              </div>
              {customer.phone && (
                <div className="summary-item">
                  <span className="label">電話番号</span>
                  <span className="value">{customer.phone}</span>
                </div>
              )}
              <div className="summary-stats">
                <div className="stat-item">
                  <div className="stat-value">{customer.ordersCount || 0}</div>
                  <div className="stat-label">総注文数</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">
                    {formatPrice(customer.totalSpent)}
                  </div>
                  <div className="stat-label">総購入額</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 注文履歴セクション */}
      <div className="orders-section">
        <div className="section-header">
          <h2>注文履歴</h2>
          <span className="order-count">{orders.length}件</span>
        </div>

        {orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛍️</div>
            <h3>まだ注文履歴がありません</h3>
            <p>商品を購入すると、こちらに表示されます</p>
            <a href="https://kanucard.com" className="shop-link">
              商品を見る
            </a>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const isExpanded = expandedOrders.has(order.orderNumber);

              return (
                <div key={order.shopifyOrderId} className="order-card">
                  <div
                    className="order-header"
                    onClick={() => toggleOrderExpand(order.orderNumber)}
                  >
                    <div className="order-main-info">
                      <span className="order-number">{order.orderNumber}</span>
                      <span className="order-date">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <div className="order-status-price">
                      <span
                        className="order-status"
                        style={{
                          backgroundColor: getStatusColor(order.financialStatus),
                          color: 'white'
                        }}
                      >
                        {getStatusLabel(order.financialStatus)}
                      </span>
                      <span className="order-total">
                        {formatPrice(order.totalPrice)}
                      </span>
                      <span className="expand-icon">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {/* 展開時の詳細情報 */}
                  {isExpanded && (
                    <div className="order-details">
                      <div className="order-fulfillment">
                        <span className="fulfillment-label">配送状況:</span>
                        <span
                          className="fulfillment-status"
                          style={{
                            color: getStatusColor(order.fulfillmentStatus)
                          }}
                        >
                          {getStatusLabel(order.fulfillmentStatus)}
                        </span>
                      </div>

                      <div className="order-items">
                        <h4>購入商品</h4>
                        {order.items && order.items.length > 0 ? (
                          <div className="items-list">
                            {order.items.map((item, index) => (
                              <div key={index} className="item">
                                <div className="item-info">
                                  <span className="product-name">
                                    {item.productName}
                                  </span>
                                  {item.variant && (
                                    <span className="variant">
                                      ({item.variant})
                                    </span>
                                  )}
                                </div>
                                <div className="item-quantity-price">
                                  <span className="quantity">
                                    数量: {item.quantity}
                                  </span>
                                  <span className="price">
                                    {formatPrice(item.price)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="no-items">商品情報がありません</p>
                        )}
                      </div>

                      <div className="order-footer">
                        <div className="order-id">
                          注文ID: {order.shopifyOrderId.split('/').pop()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className="page-actions">
        <button
          onClick={() => window.location.href = '/'}
          className="btn btn-secondary"
        >
          ホームに戻る
        </button>
        <button
          onClick={fetchOrders}
          className="btn btn-primary"
        >
          更新
        </button>
      </div>
    </div>
  );
};

export default MyOrders;