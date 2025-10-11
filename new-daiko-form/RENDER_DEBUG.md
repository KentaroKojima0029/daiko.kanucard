# Render デバッグガイド

## 🔍 現在のエラー

```
[WARN] Failed to send verification code {
  error: 'このメールアドレスはShopifyに登録されていません。先にShopifyでアカウントを作成してください。'
}
```

## 📋 確認手順

### 1. Renderのログを確認

Renderダッシュボード → `new-daiko-form` → **Logs**タブ

以下のログが表示されているか確認してください：

#### ✅ 正常な場合
```
Database initialized successfully
[shopify-api/INFO] version 12.0.0, environment Node v22.16.0
Server running on port 3000
```

#### ❌ 環境変数未設定の場合
```
Shopify credentials not configured. Customer lookup will be disabled.
```

### 2. 環境変数を確認

Renderダッシュボード → `new-daiko-form` → **Environment**タブ

以下の環境変数が**すべて**設定されているか確認：

- [ ] `SHOPIFY_SHOP_NAME` = `kanucard` （`.myshopify.com`は不要）
- [ ] `SHOPIFY_ADMIN_ACCESS_TOKEN` = `(Shopifyの実際のアクセストークンを入力)`
- [ ] `SMTP_HOST` = `sv10210.xserver.jp`
- [ ] `SMTP_PORT` = `587`
- [ ] `SMTP_USER` = `collection@kanucard.com`
- [ ] `SMTP_PASS` = `(Xserverのメールパスワードを入力)`
- [ ] `FROM_EMAIL` = `collection@kanucard.com`
- [ ] `ADMIN_EMAIL` = `contact@kanucard.com`
- [ ] `MAIL_DEBUG` = `false`
- [ ] `JWT_SECRET` = `(ランダムな秘密鍵を生成して入力)`
- [ ] `SESSION_SECRET` = `(ランダムな秘密鍵を生成して入力)`
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `3000`

### 3. デプロイ状況を確認

Renderダッシュボード → `new-daiko-form` → **Events**タブ

- 最新のデプロイが「**Live**」になっているか確認
- デプロイ時刻が環境変数設定後になっているか確認

### 4. 使用しているメールアドレスを確認

入力したメールアドレスが**本当にShopifyに登録されているか**確認：

1. Shopify管理画面にログイン
2. 左メニュー「顧客」→「顧客管理」
3. 入力したメールアドレスで検索
4. 顧客が存在するか確認

### 5. 手動再デプロイを試す

環境変数を設定したが再デプロイされていない可能性があります：

1. Renderダッシュボード → `new-daiko-form`
2. 右上の「**Manual Deploy**」ボタンをクリック
3. 「**Deploy latest commit**」を選択
4. デプロイ完了を待つ（2-5分）

## 🐛 トラブルシューティング

### ケース1: "Shopify credentials not configured" がログに表示される

**原因**: 環境変数が設定されていない、または再デプロイされていない

**解決策**:
1. Environmentタブで環境変数を確認
2. 「Save Changes」をクリック
3. Manual Deployで再デプロイ

### ケース2: メールアドレスがShopifyに登録されていない

**原因**: 入力したメールアドレスがShopifyに存在しない

**解決策**:
1. Shopify管理画面で顧客が存在するか確認
2. 存在しない場合は、Shopifyで顧客を作成
3. または、既存の顧客のメールアドレスを使用

### ケース3: Shopify APIトークンが無効

**原因**: アクセストークンが間違っているか、権限が不足している

**解決策**:
1. Shopify管理画面 → 設定 → アプリと販売チャネル
2. カスタムアプリのアクセストークンを再確認
3. 権限に「read_customers」が含まれているか確認

## 📞 次のステップ

上記の確認手順を実行後、以下の情報を教えてください：

1. Logsタブに "Shopify credentials not configured" が表示されるか？
2. 使用したメールアドレスは？（例: test@example.com）
3. そのメールアドレスはShopifyに登録されているか？
4. 最新のデプロイは成功しているか？（Eventsタブで確認）
