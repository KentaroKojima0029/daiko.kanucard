/**
 * ログインコンポーネントの例
 * ユーザー認証機能の実装例
 */

import React, { useState, useEffect } from 'react';
import api from '../../lib/api';

const Login = () => {
  // フォームの状態管理
  const [isLoginMode, setIsLoginMode] = useState(true); // true: ログイン, false: 新規登録
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    rememberMe: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // コンポーネントマウント時にログイン状態を確認
  useEffect(() => {
    checkLoginStatus();
  }, []);

  // ログイン状態の確認
  const checkLoginStatus = async () => {
    try {
      if (api.utils.isLoggedIn()) {
        const user = await api.auth.getCurrentUser();
        if (user.success && user.data) {
          setIsLoggedIn(true);
          setCurrentUser(user.data);
        }
      }
    } catch (err) {
      console.error('ログイン状態確認エラー:', err);
    }
  };

  // フォーム入力の更新
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setError(null); // エラーをクリア
  };

  // ログイン処理
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 入力値の検証
      if (!formData.email || !formData.password) {
        throw { message: 'メールアドレスとパスワードを入力してください' };
      }

      // APIを使用してログイン
      const result = await api.auth.login(
        formData.email,
        formData.password,
        formData.rememberMe
      );

      console.log('ログイン成功:', result);
      setSuccess('ログインに成功しました');
      setIsLoggedIn(true);
      setCurrentUser(result.data.user);

      // フォームをリセット
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        phone: '',
        rememberMe: false,
      });

      // ダッシュボードへリダイレクト（例）
      setTimeout(() => {
        // window.location.href = '/dashboard';
        console.log('ダッシュボードへリダイレクト');
      }, 1500);

    } catch (err) {
      console.error('ログイン失敗:', err);
      setError(api.utils.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 新規登録処理
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // パスワード確認
      if (formData.password !== formData.confirmPassword) {
        throw { message: 'パスワードが一致しません' };
      }

      // APIを使用して新規登録
      const result = await api.auth.register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
      });

      console.log('登録成功:', result);
      setSuccess('アカウントの作成に成功しました。確認メールをご確認ください。');
      setIsLoggedIn(true);
      setCurrentUser(result.data.user);

      // フォームをリセット
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        phone: '',
        rememberMe: false,
      });

      // ダッシュボードへリダイレクト
      setTimeout(() => {
        // window.location.href = '/dashboard';
        console.log('ダッシュボードへリダイレクト');
      }, 2000);

    } catch (err) {
      console.error('登録失敗:', err);
      setError(api.utils.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    setLoading(true);

    try {
      await api.auth.logout();
      setIsLoggedIn(false);
      setCurrentUser(null);
      setSuccess('ログアウトしました');

      // ホームページへリダイレクト
      setTimeout(() => {
        // window.location.href = '/';
        console.log('ホームページへリダイレクト');
      }, 1000);

    } catch (err) {
      console.error('ログアウト失敗:', err);
      setError(api.utils.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // パスワードリセット要求
  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('メールアドレスを入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.auth.forgotPassword(formData.email);
      setSuccess('パスワードリセット用のメールを送信しました。メールをご確認ください。');
    } catch (err) {
      console.error('パスワードリセット要求失敗:', err);
      setError(api.utils.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ログイン済みの場合の表示
  if (isLoggedIn && currentUser) {
    return (
      <div className="login-container">
        <div className="user-info">
          <h2>ようこそ、{currentUser.name}さん</h2>
          <p>メールアドレス: {currentUser.email}</p>

          <div className="user-actions">
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="btn btn-primary"
            >
              ダッシュボードへ
            </button>

            <button
              onClick={() => window.location.href = '/profile'}
              className="btn btn-secondary"
            >
              プロフィール設定
            </button>

            <button
              onClick={handleLogout}
              className="btn btn-outline"
              disabled={loading}
            >
              {loading ? 'ログアウト中...' : 'ログアウト'}
            </button>
          </div>

          {/* メッセージ表示 */}
          {success && (
            <div className="alert alert-success">
              {success}
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ログイン/新規登録フォーム
  return (
    <div className="login-container">
      <div className="login-form">
        <h2>{isLoginMode ? 'ログイン' : '新規アカウント作成'}</h2>

        <div className="form-mode-toggle">
          <button
            type="button"
            className={isLoginMode ? 'active' : ''}
            onClick={() => {
              setIsLoginMode(true);
              setError(null);
              setSuccess(null);
            }}
          >
            ログイン
          </button>
          <button
            type="button"
            className={!isLoginMode ? 'active' : ''}
            onClick={() => {
              setIsLoginMode(false);
              setError(null);
              setSuccess(null);
            }}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={isLoginMode ? handleLogin : handleRegister}>
          {/* 新規登録時のみ名前入力 */}
          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="name">
                お名前 <span className="required">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="山田 太郎"
                required={!isLoginMode}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">
              メールアドレス <span className="required">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="example@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              パスワード <span className="required">*</span>
            </label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="8文字以上"
              required
              autoComplete={isLoginMode ? "current-password" : "new-password"}
              minLength="8"
            />
          </div>

          {/* 新規登録時のみパスワード確認 */}
          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="confirmPassword">
                パスワード（確認） <span className="required">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder="パスワードを再入力"
                required={!isLoginMode}
                minLength="8"
              />
            </div>
          )}

          {/* 新規登録時のみ電話番号入力（任意） */}
          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="phone">電話番号（任意）</label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="090-1234-5678"
              />
            </div>
          )}

          {/* ログイン時のみ「ログイン状態を保持」オプション */}
          {isLoginMode && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                />
                ログイン状態を保持する
              </label>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {/* 成功表示 */}
          {success && (
            <div className="alert alert-success">
              {success}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '処理中...' : (isLoginMode ? 'ログイン' : '登録する')}
            </button>

            {/* パスワードを忘れた場合のリンク（ログイン時のみ） */}
            {isLoginMode && (
              <button
                type="button"
                className="btn-link"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                パスワードを忘れた場合
              </button>
            )}
          </div>
        </form>

        <div className="form-footer">
          {isLoginMode ? (
            <p>
              アカウントをお持ちでない方は
              <button
                type="button"
                className="btn-link"
                onClick={() => setIsLoginMode(false)}
              >
                新規登録
              </button>
            </p>
          ) : (
            <p>
              すでにアカウントをお持ちの方は
              <button
                type="button"
                className="btn-link"
                onClick={() => setIsLoginMode(true)}
              >
                ログイン
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;