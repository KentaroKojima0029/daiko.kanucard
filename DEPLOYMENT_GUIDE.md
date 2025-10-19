# 本番環境デプロイガイド

## 🚀 デプロイ先の環境変数設定

本番環境（Render.com、Heroku、Xserver VPS等）でアプリケーションを動作させるために、以下の環境変数を設定してください。

### 必須環境変数

#### 1. 基本設定
```
NODE_ENV=production
PORT=3000
```

#### 2. Shopify API設定
```
SHOPIFY_SHOP_NAME=your-shop-name
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_VERSION=2024-10
```

#### 3. JWT認証設定
```
JWT_SECRET=your-secure-jwt-secret-key-change-this-in-production
```

#### 4. SMTP設定（メール送信）
```
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-smtp-password
FROM_EMAIL=your-email@example.com
ADMIN_EMAIL=admin@example.com
MAIL_DEBUG=false
```

#### 5. 管理者認証
```
ADMIN_USER=admin
ADMIN_PASSWORD=your-secure-admin-password
```

## 📝 Render.comでの設定手順

1. **Render.comにログイン**
2. **対象のWeb Serviceを選択**
3. **Environment → Environment Variables**
4. **上記の環境変数を一つずつ追加**
5. **Save Changes**
6. **Manual Deploy → Deploy latest commit**

## 🔍 トラブルシューティング

### OTP認証コードが送信されない場合

1. **環境変数の確認**
   - すべての環境変数が正しく設定されているか確認
   - 特にSMTP関連の設定を再確認

2. **ログの確認**
   - Render.comのLogsタブでエラーメッセージを確認
   - `[OTP]`で始まるデバッグログを確認

3. **よくあるエラーと対処法**

#### エラー: "Shopify API Error"
```
原因: Shopify APIトークンが無効または期限切れ
対処: SHOPIFY_ADMIN_ACCESS_TOKENを最新のものに更新
```

#### エラー: "Failed to send OTP email"
```
原因: SMTP設定が正しくない
対処:
- SMTP_HOST, SMTP_PORT, SMTP_USERを確認
- SMTP_PASSが正しいか確認
- ファイアウォールでポート587がブロックされていないか確認
```

#### エラー: "システムエラーが発生しました"
```
原因: 本番環境でエラーが発生している
対処:
- Render.comのログで詳細なエラーを確認
- NODE_ENVがproductionに設定されているか確認
```

## 🎯 動作確認手順

1. **本番環境URL（https://daiko.kanucard.com）にアクセス**
2. **メールアドレスを入力**
3. **OTP認証コードが届くことを確認**
4. **6桁のコードを入力してログイン**
5. **ホーム画面が表示されることを確認**

## 📊 環境変数チェックリスト

- [ ] NODE_ENV = production
- [ ] SHOPIFY_SHOP_NAME = 設定済み
- [ ] SHOPIFY_ADMIN_ACCESS_TOKEN = 正しいトークン
- [ ] SHOPIFY_API_VERSION = 2024-10
- [ ] JWT_SECRET = 設定済み
- [ ] SMTP_HOST = 設定済み
- [ ] SMTP_PORT = 587
- [ ] SMTP_USER = 設定済み
- [ ] SMTP_PASS = 正しいパスワード
- [ ] FROM_EMAIL = 設定済み
- [ ] ADMIN_EMAIL = 設定済み

## 🔒 セキュリティ注意事項

1. **本番環境では必ず`NODE_ENV=production`を設定**
2. **JWT_SECRETは定期的に変更を推奨**
3. **SMTP_PASSは安全に管理**
4. **ShopifyのAPIトークンは定期的に更新**

## 📞 サポート

問題が解決しない場合は、以下の情報と共にお問い合わせください：

1. エラーメッセージの全文
2. Render.comのログ（最新100行）
3. 試した対処法
4. 発生時刻とメールアドレス

---

最終更新: 2025-10-19