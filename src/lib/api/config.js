/**
 * API設定ファイル
 * PSA鑑定代行APIサーバーへの接続設定とトークン管理
 */

// API基本設定
export const API_CONFIG = {
  // 本番環境のAPIエンドポイント
  baseURL: process.env.API_BASE_URL || 'https://api.kanucard.com',

  // リクエストのタイムアウト時間（30秒）
  timeout: 30000,

  // デフォルトヘッダー
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },

  // リトライ設定
  retry: {
    maxRetries: 3,
    retryDelay: 1000, // 1秒
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  }
};

// トークン管理用のキー
export const TOKEN_KEY = 'kanucard_auth_token';
export const REFRESH_TOKEN_KEY = 'kanucard_refresh_token';
export const USER_KEY = 'kanucard_user_data';

// APIエンドポイント定義
export const API_ENDPOINTS = {
  // 認証関連
  auth: {
    register: '/api/auth/register',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
    verifyEmail: '/api/auth/verify-email',
    forgotPassword: '/api/auth/forgot-password',
    resetPassword: '/api/auth/reset-password',
  },

  // フォーム関連
  forms: {
    submit: '/api/submit-form',
    list: '/api/customer/forms',
    detail: '/api/customer/forms/{id}',
    cancel: '/api/customer/forms/{id}/cancel',
    update: '/api/customer/forms/{id}',
  },

  // メッセージ関連
  messages: {
    send: '/api/customer/messages',
    list: '/api/customer/messages',
    byForm: '/api/customer/messages/form/{formId}',
    read: '/api/customer/messages/{id}/read',
  },

  // ファイルアップロード
  upload: {
    image: '/api/upload/image',
    document: '/api/upload/document',
  },

  // 通知
  notifications: {
    list: '/api/customer/notifications',
    markRead: '/api/customer/notifications/{id}/read',
    markAllRead: '/api/customer/notifications/read-all',
  },

  // 管理者API
  admin: {
    // ダッシュボード
    dashboard: '/api/admin/dashboard',

    // 申請管理
    forms: '/api/admin/forms',
    formDetail: '/api/admin/forms/{id}',
    formUpdate: '/api/admin/forms/{id}',
    formDelete: '/api/admin/forms/{id}',
    formNotes: '/api/admin/forms/{id}/notes',
    export: '/api/admin/forms/export',

    // 顧客管理
    customers: '/api/admin/customers',
    customerDetail: '/api/admin/customers/{id}',
    customerForms: '/api/admin/customers/{id}/forms',

    // メッセージ
    sendMessage: '/api/admin/messages',

    // レポート・統計
    reports: '/api/admin/reports',

    // システム設定
    settings: '/api/admin/settings',

    // 管理者ユーザー管理
    users: '/api/admin/users',
    userUpdate: '/api/admin/users/{id}',
    userDelete: '/api/admin/users/{id}',
  }
};

// 環境設定
export const ENV = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  enableLogs: process.env.ENABLE_API_LOGS === 'true',
};

// エラーコード定義
export const ERROR_CODES = {
  // ネットワークエラー
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',

  // 認証エラー
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // リクエストエラー
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // サーバーエラー
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // アプリケーションエラー
  FORM_SUBMISSION_FAILED: 'FORM_SUBMISSION_FAILED',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  MESSAGE_SEND_FAILED: 'MESSAGE_SEND_FAILED',
};

// エラーメッセージ定義
export const ERROR_MESSAGES = {
  [ERROR_CODES.NETWORK_ERROR]: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
  [ERROR_CODES.TIMEOUT]: 'リクエストがタイムアウトしました。もう一度お試しください。',
  [ERROR_CODES.UNAUTHORIZED]: 'ログインが必要です。',
  [ERROR_CODES.FORBIDDEN]: 'このリソースへのアクセス権限がありません。',
  [ERROR_CODES.TOKEN_EXPIRED]: 'セッションの有効期限が切れました。再度ログインしてください。',
  [ERROR_CODES.INVALID_CREDENTIALS]: 'メールアドレスまたはパスワードが正しくありません。',
  [ERROR_CODES.BAD_REQUEST]: 'リクエストが不正です。',
  [ERROR_CODES.NOT_FOUND]: '要求されたリソースが見つかりません。',
  [ERROR_CODES.VALIDATION_ERROR]: '入力内容に誤りがあります。',
  [ERROR_CODES.DUPLICATE_ENTRY]: 'すでに登録されています。',
  [ERROR_CODES.SERVER_ERROR]: 'サーバーエラーが発生しました。しばらくしてからもう一度お試しください。',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'サービスが一時的に利用できません。',
  [ERROR_CODES.FORM_SUBMISSION_FAILED]: 'フォームの送信に失敗しました。',
  [ERROR_CODES.FILE_UPLOAD_FAILED]: 'ファイルのアップロードに失敗しました。',
  [ERROR_CODES.MESSAGE_SEND_FAILED]: 'メッセージの送信に失敗しました。',
};

// フォームステータス定義
export const FORM_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  GRADING: 'grading',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

// 料金プラン設定
export const PLANS = {
  psa: {
    economy: { name: 'エコノミー', value: 'economy' },
    value: { name: 'バリュー', value: 'value' },
    regular: { name: 'レギュラー', value: 'regular' },
    express: { name: 'エクスプレス', value: 'express' },
  },
  agent: {
    basic: { name: '基本プラン', value: 'basic' },
    standard: { name: 'スタンダード', value: 'standard' },
    premium: { name: 'プレミアム', value: 'premium' },
  }
};

// デフォルトエクスポート
export default {
  API_CONFIG,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  API_ENDPOINTS,
  ENV,
  ERROR_CODES,
  ERROR_MESSAGES,
  FORM_STATUS,
  PLANS,
};