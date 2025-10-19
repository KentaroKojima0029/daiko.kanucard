# Render 環境変数設定ガイド

## 🔧 デプロイエラーの原因

Renderでは`.env`ファイルは使用されません。すべての環境変数をRenderダッシュボードで設定する必要があります。

## 📋 必須環境変数リスト

Renderの「Environment」タブで以下の環境変数を設定してください：

### 1. SMTP設定（メール認証用）
```
SMTP_HOST=sv10210.xserver.jp
SMTP_PORT=587
SMTP_USER=collection@kanucard.com
SMTP_PASS=（Xserverのメールパスワードを入力）
FROM_EMAIL=collection@kanucard.com
ADMIN_EMAIL=contact@kanucard.com
MAIL_DEBUG=false
```

### 2. Shopify設定
```
SHOPIFY_SHOP_NAME=kanucard
SHOPIFY_ADMIN_ACCESS_TOKEN=（Shopifyの実際のトークンを入力）
```

### 3. セキュリティ設定
```
JWT_SECRET=kanucard-psa-daiko-service-jwt-secret-2025-random-key-349857
SESSION_SECRET=kanucard-session-secret-key-2025-349857
```

### 4. サーバー設定
```
NODE_ENV=production
PORT=3000
```

## 🚀 Renderでの環境変数設定手順

1. **Renderダッシュボードにログイン**
   - https://dashboard.render.com/ にアクセス

2. **サービスを選択**
   - `new-daiko-form` サービスをクリック

3. **Environmentタブに移動**
   - 左サイドバーの「Environment」をクリック

4. **環境変数を追加**
   - 「Add Environment Variable」ボタンをクリック
   - 上記のキーと値を一つずつ追加
   - または「Add from .env」で一括追加

5. **保存して再デプロイ**
   - 「Save Changes」ボタンをクリック
   - 自動的に再デプロイが開始されます

## ⚠️ 重要な注意事項

- **NODE_ENV**: 必ず `production` に設定
- **SHOPIFY_ADMIN_ACCESS_TOKEN**: 実際のトークンを使用
- **パスワード類**: コピー&ペーストで正確に入力
- すべての変数を設定後、手動で「Manual Deploy」を実行

## 🔍 設定確認

環境変数設定後、デプロイログで以下を確認：
- ✅ ビルドが成功
- ✅ サーバーが起動（"Server running on port 3000"）
- ✅ エラーなし

## 📞 サポート

設定後もエラーが発生する場合は、Renderの「Logs」タブでエラー詳細を確認してください。
