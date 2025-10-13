# VPS更新手順ガイド

## 最新のコードをVPSにデプロイする

### ステップ1: VPSにSSH接続

```bash
ssh root@x162-43-92-176.static.ctinets.com
```

### ステップ2: アプリケーションディレクトリに移動

```bash
cd /var/www/psa-api
```

### ステップ3: 最新のコードを取得

```bash
# 現在のブランチを確認
git branch

# xserver-vpsブランチに切り替え（まだの場合）
git checkout xserver-vps

# 最新のコードを取得
git pull origin xserver-vps
```

### ステップ4: 依存パッケージをインストール

```bash
npm install --production
```

### ステップ5: 環境変数を設定

```bash
# .envファイルを編集
nano .env
```

以下の環境変数を追加（まだない場合）：

```env
# メール送信API認証キー（新規生成）
XSERVER_API_KEY=（下記コマンドで生成したキーを貼り付け）
```

APIキーを生成：

```bash
# 新しいAPIキーを生成
openssl rand -hex 32

# 出力されたキーをコピー
# 例: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

生成されたキーを`.env`ファイルの`XSERVER_API_KEY`に貼り付けて保存（Ctrl+O → Enter → Ctrl+X）

### ステップ6: PM2でサーバーを再起動

```bash
# サーバーを再起動
pm2 restart psa-api

# ログを確認
pm2 logs psa-api --lines 50
```

### ステップ7: 動作確認

#### 7-1. サーバーが起動しているか確認

```bash
pm2 status
```

期待される出力:
```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┤
│ 0  │ psa-api            │ fork     │ 0    │ online    │ 0%       │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┘
```

#### 7-2. ヘルスチェック

```bash
curl http://localhost:3000/api/health
```

#### 7-3. メール送信APIのテスト

```bash
# 環境変数からAPIキーを取得
API_KEY=$(grep XSERVER_API_KEY .env | cut -d '=' -f2)

# APIをテスト
curl -X POST http://localhost:3000/api/send-email \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  -d '{
    "to": "test@example.com",
    "subject": "VPS API Test",
    "html": "<h1>Test Email</h1><p>VPS mail API is working!</p>"
  }'
```

**期待される成功レスポンス:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "<random-id@kanucard.com>"
}
```

**エラーが出た場合の対処:**

```bash
# ログを詳細に確認
pm2 logs psa-api --lines 100

# 環境変数を確認
cat .env | grep XSERVER_API_KEY

# サーバーを再起動
pm2 restart psa-api
```

### ステップ8: Render側の環境変数を設定

VPS側のAPIキーが確認できたら、Render側に同じAPIキーを設定します。

#### 8-1. APIキーを確認

```bash
# VPS上で実行
grep XSERVER_API_KEY .env
```

出力例:
```
XSERVER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

このキーをコピーします。

#### 8-2. Renderダッシュボードで設定

1. https://dashboard.render.com にログイン
2. 対象のWebサービスを選択
3. 左メニューから「Environment」をクリック
4. 以下の環境変数を追加：

| Key | Value |
|-----|-------|
| `USE_XSERVER_FALLBACK` | `true` |
| `XSERVER_API_URL` | `https://api.kanucard.com` |
| `XSERVER_API_KEY` | （VPSからコピーしたキー） |

5. 「Save Changes」をクリック
6. 再デプロイを待つ

### ステップ9: エンドツーエンドテスト

#### 9-1. Renderログを確認

デプロイ完了後、Renderのログで以下を確認：

```
[email-service] ✓ Fallback configuration complete
[email-service] ✓ Email configuration valid
```

#### 9-2. Renderアプリケーションからメール送信をテスト

ブラウザでフォームにアクセスしてメール送信をテスト。

**成功時のログ（Render側）:**
```
[email-service] Starting email send process
[email-service] Attempting SMTP send...
[email-service] ✗ SMTP send failed: Connection timeout
[email-service] Attempting XserverVPS API fallback...
[email-service] ✓ XserverVPS API send successful
```

**成功時のログ（VPS側）:**
```bash
# VPS上でログを確認
pm2 logs psa-api

# 以下のようなログが表示されるはず
[email-api] Email API request received
[email-api] Email sent successfully via API
```

## トラブルシューティング

### エラー: "リクエストされたリソースが見つかりません"

**原因**: `/api/send-email`エンドポイントが存在しない

**解決方法**:
```bash
# 最新のコードを確認
cd /var/www/psa-api
git status
git log --oneline -5

# 最新のコミットに"メール送信API"が含まれているか確認
# 含まれていない場合は再度git pull
git pull origin xserver-vps

# サーバー再起動
pm2 restart psa-api
```

### エラー: "Invalid API key"

**原因**: VPS側とRender側でAPIキーが一致していない

**解決方法**:
```bash
# VPS側のAPIキーを確認
grep XSERVER_API_KEY .env

# Render側の環境変数と一致しているか確認
# 一致していない場合はRenderで修正
```

### エラー: "SMTP connection failed"

**原因**: VPS側のSMTP設定が不正

**解決方法**:
```bash
# SMTP設定を確認
cat .env | grep SMTP

# 設定が正しいか確認
# SMTP_HOST=sv10210.xserver.jp
# SMTP_PORT=587
# SMTP_USER=collection@kanucard.com
# SMTP_PASS=Kanu29012300
```

### サーバーが起動しない

**原因**: 構文エラーまたは依存関係の問題

**解決方法**:
```bash
# エラーログを確認
pm2 logs psa-api --err

# 構文チェック
node server.js

# 依存パッケージを再インストール
npm install --production

# サーバー再起動
pm2 restart psa-api
```

## 完了チェックリスト

- [ ] VPSに最新のコードがデプロイされた
- [ ] `XSERVER_API_KEY`が`.env`に設定された
- [ ] PM2でサーバーが正常に起動している
- [ ] `/api/send-email`エンドポイントが動作している
- [ ] Render側に同じAPIキーが設定された
- [ ] Renderログでフォールバック設定が有効と表示される
- [ ] メール送信がフォールバック経由で成功する

---

**次のステップ**: すべてのチェックリストが完了したら、実際のフォームからメール送信をテストしてください。
