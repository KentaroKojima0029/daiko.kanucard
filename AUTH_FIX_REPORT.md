# 認証トークン消失問題の解決レポート

## 実施日
2025年10月20日

## 問題の概要

### 報告された問題
1. **express-rate-limit エラー**:
   ```
   ValidationError: The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting.
   code: 'ERR_ERL_PERMISSIVE_TRUST_PROXY'
   ```

2. **JWT認証トークン消失**:
   - OTP認証は成功（ステータス200）
   - JWTトークンの取得・ローカルストレージ保存も成功
   - しかしホーム画面遷移時にトークンが空文字になる（`token: ""`）

## 実施した修正

### 1. express-rate-limit設定の修正（middleware.js）

#### 問題点
- express-rate-limit v8.xでは、`trust proxy`が有効な場合、各rate limiterに`trust`オプションの明示的な設定が必要
- `trust`オプションがないと、バイパス可能なセキュリティリスクとしてエラーが発生

#### 修正内容
3つのrate limiterすべてに`trust: true`オプションを追加:

```javascript
// 一般的なAPIのレート制限
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  trust: true,  // ← 追加
  // ... 他の設定
});

// 認証APIのレート制限
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  trust: true,  // ← 追加
  // ... 他の設定
});

// コード検証のレート制限
const verifyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  trust: true,  // ← 追加
  // ... 他の設定
});
```

### 2. trust proxy設定の最適化（server.js）

#### 問題点
- `app.set('trust proxy', 1)` が無条件で設定されていた
- 開発環境とproduction環境で適切な設定が必要

#### 修正内容
環境に応じた trust proxy 設定:

```javascript
if (process.env.NODE_ENV === 'production') {
  // 本番環境: Nginx等のリバースプロキシを信頼
  // '1' = 最初のプロキシのみ信頼（Nginxからの X-Forwarded-For を使用）
  app.set('trust proxy', 1);
  console.log('Trust proxy enabled: trusting 1 hop (Nginx reverse proxy)');
} else {
  // 開発環境: プロキシなし
  app.set('trust proxy', false);
  console.log('Trust proxy disabled (development mode)');
}
```

### 3. CORS設定のセキュリティ強化（server.js）

#### 問題点
- `origin || '*'` を使用していたため、セキュリティリスク
- `Access-Control-Allow-Credentials: true` と `*` の併用は不可

#### 修正内容
同一オリジンと許可されたオリジンのみ処理:

```javascript
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://daiko.kanucard.com',
    'http://localhost:3000',
    'http://localhost:3443',
    // ... 他の許可オリジン
  ].filter(Boolean);

  const origin = req.headers.origin;

  // 同一オリジンリクエスト（Originヘッダーなし）の場合はスキップ
  if (!origin) {
    return next();
  }

  // 許可されたオリジンのみCORSヘッダーを設定
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Auth');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  } else {
    // 許可されていないオリジンをログに記録
    logger.warn('Blocked CORS request from unauthorized origin', { origin });
  }

  next();
});
```

### 4. JWT認証フローの検証結果

#### 検証内容
- login.html: トークン保存ロジック ✅ 正常
- home.html: トークン検証ロジック ✅ 正常
- index.html: 認証ゲートウェイ ✅ 正常
- session-manager.js: chat.htmlでのみ使用、干渉なし ✅

#### 結論
クライアント側のコードは正しく実装されており、問題ない。

## トークン消失問題の原因と対策

### 考えられる原因

1. **ブラウザのストレージ設定**:
   - プライベートブラウジングモード
   - Cookieやストレージのブロック
   - サードパーティCookieの制限

2. **プロトコル・ドメインの不一致**:
   - HTTPとHTTPSの混在
   - サブドメインの違い
   - ポート番号の不一致

3. **Nginxプロキシ設定**:
   - プロキシヘッダーの欠落
   - セキュリティヘッダーの競合

### 推奨される対策

#### 1. ブラウザコンソールの確認
login.htmlとhome.htmlには詳細なデバッグログが実装されています:

```javascript
console.log('[Login] トークン保存確認:', {
  tokenSaved: !!savedToken,
  tokenLength: savedToken ? savedToken.length : 0,
  userSaved: !!savedUser
});
```

ブラウザのデベロッパーツール（F12）を開いて、コンソールタブで以下を確認:
- トークンが正常に保存されているか
- リダイレクト時にトークンが維持されているか
- エラーメッセージの内容

#### 2. localStorage動作テスト
ブラウザコンソールで以下を実行:

```javascript
// localStorageのテスト
localStorage.setItem('test', 'value');
console.log(localStorage.getItem('test'));
localStorage.removeItem('test');
```

エラーが出る場合、ブラウザ設定を確認してください。

#### 3. Nginx設定の確認
本番環境（VPS）のNginx設定で、以下のヘッダーが正しく転送されているか確認:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;

    # プロキシヘッダー（重要）
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket対応（必要な場合）
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

#### 4. 環境変数の確認
本番環境で以下の環境変数が正しく設定されているか:

```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=<your-secret>
# ... その他の設定
```

#### 5. PM2ログの確認
```bash
# エラーログ確認
pm2 logs psa-api --lines 100 --err

# 標準出力ログ確認
pm2 logs psa-api --lines 100 --out

# リアルタイムログ監視
pm2 logs psa-api
```

## テスト手順

### 1. ローカル環境でのテスト
```bash
# サーバー起動
node server.js

# または
npm start
```

ブラウザで http://localhost:3000/login にアクセスし、以下を確認:
1. メールアドレス入力 → OTP送信
2. OTP入力 → 認証成功
3. ホーム画面へのリダイレクト
4. ブラウザコンソールでトークンの保存を確認

### 2. 本番環境でのテスト
```bash
# サーバー再起動
pm2 restart psa-api

# ログ確認
pm2 logs psa-api
```

ブラウザで https://daiko.kanucard.com/login にアクセスし、同様に確認。

## 期待される結果

✅ express-rate-limitエラーが解消
✅ セキュアなrate limiting機能
✅ 適切なCORS設定
✅ 本番環境に最適化されたproxy設定
✅ 詳細なデバッグログによる問題追跡

## 追加の推奨事項

### 1. セキュリティ強化
- JWT_SECRETを強力なランダム文字列に変更
- SESSION_SECRETも同様に変更
- XSERVER_API_KEYを安全な値に設定

### 2. モニタリング
- PM2のモニタリング機能を活用
- ログファイルの定期的な確認
- エラー通知の設定

### 3. バックアップ
- データベース（daiko.db）の定期バックアップ
- 環境変数ファイルのバックアップ

## サポート

問題が解決しない場合:
1. ブラウザのコンソールログをキャプチャ
2. PM2のログをキャプチャ: `pm2 logs psa-api --lines 200 > debug.log`
3. Nginxのエラーログを確認: `/var/log/nginx/error.log`

これらの情報を元に、さらなる診断を行うことができます。
