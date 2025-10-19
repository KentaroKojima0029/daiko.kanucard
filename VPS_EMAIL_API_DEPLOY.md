# VPS側メール送信API デプロイガイド

このガイドは、Xserver VPS (`https://api.kanucard.com`) にメール送信APIをデプロイする手順を説明します。

---

## 📋 前提条件

- Xserver VPS にSSHでアクセス可能
- Node.js v14以上がインストールされている
- npm がインストールされている
- ドメイン `api.kanucard.com` がVPSに設定されている
- Nginx または Apache がリバースプロキシとして設定されている

---

## 🚀 デプロイ手順

### ステップ1: VPSにSSH接続

```bash
ssh user@api.kanucard.com
```

### ステップ2: プロジェクトディレクトリを作成

```bash
# ホームディレクトリまたは適切な場所に作成
mkdir -p ~/email-api
cd ~/email-api
```

### ステップ3: 必要なファイルをアップロード

以下の2ファイルをVPSにアップロード:

1. **vps-email-api.js** - メール送信APIサーバー
2. **.env.vps** → `.env` にリネーム

**アップロード方法の例（ローカルから実行）:**

```bash
# SCPを使用してファイルをアップロード
scp vps-email-api.js user@api.kanucard.com:~/email-api/
scp .env.vps user@api.kanucard.com:~/email-api/.env
```

または、VPS上で直接作成:

```bash
# VPS上で実行
cd ~/email-api

# vps-email-api.js を作成
nano vps-email-api.js
# （内容をコピー&ペースト）

# .env を作成
nano .env
# （内容をコピー&ペースト）
```

### ステップ4: 依存関係をインストール

```bash
cd ~/email-api

# package.json を作成
cat > package.json <<'EOF'
{
  "name": "vps-email-api",
  "version": "1.0.0",
  "description": "VPS Email Sending API",
  "main": "vps-email-api.js",
  "scripts": {
    "start": "node vps-email-api.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "nodemailer": "^6.10.1",
    "dotenv": "^16.0.0"
  }
}
EOF

# 依存関係をインストール
npm install
```

### ステップ5: .env ファイルを設定

```bash
nano .env
```

以下の内容を設定:

```env
EMAIL_API_PORT=3001
NODE_ENV=production
SMTP_HOST=sv10210.xserver.jp
SMTP_PORT=587
SMTP_USER=contact@kanucard.com
SMTP_PASS=Kanu29012300
FROM_EMAIL=contact@kanucard.com
```

### ステップ6: サーバーを起動（テスト）

```bash
# 一度テスト起動
node vps-email-api.js
```

以下のようなメッセージが表示されれば成功:

```
========================================
✓ VPS Email API Server Started
Port: 3001
SMTP Host: sv10210.xserver.jp
SMTP User: contact@kanucard.com
FROM Email: contact@kanucard.com
========================================
Endpoints:
  GET  /api/health       - Health check
  POST /api/send-email   - Send email
========================================
```

**Ctrl+C** で一度停止します。

### ステップ7: PM2で常駐化

PM2を使用してサーバーを常駐させます:

```bash
# PM2をグローバルインストール（まだの場合）
npm install -g pm2

# サーバーを起動
pm2 start vps-email-api.js --name email-api

# 起動状態を確認
pm2 status

# ログを確認
pm2 logs email-api

# 自動起動を有効化
pm2 startup
pm2 save
```

### ステップ8: Nginxリバースプロキシ設定

Nginxを使用している場合、以下の設定を追加:

```bash
sudo nano /etc/nginx/sites-available/api.kanucard.com
```

以下を追加または既存の設定に統合:

```nginx
server {
    listen 80;
    server_name api.kanucard.com;

    # SSL設定（既に設定済みの場合はスキップ）
    # listen 443 ssl;
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    # メール送信APIへのプロキシ
    location /api/send-email {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # ヘルスチェック
    location /api/health {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }
}
```

Nginx設定を反映:

```bash
# 設定テスト
sudo nginx -t

# Nginx再起動
sudo systemctl reload nginx
```

### ステップ9: 動作確認

#### ヘルスチェック

```bash
curl https://api.kanucard.com/api/health
```

**期待されるレスポンス:**
```json
{
  "status": "ok",
  "service": "VPS Email API",
  "timestamp": "2025-10-19T12:00:00.000Z"
}
```

#### メール送信テスト

```bash
curl -X POST https://api.kanucard.com/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test Email from VPS API",
    "text": "This is a test email",
    "html": "<h1>Test Email</h1><p>This is a test email from VPS API</p>"
  }'
```

**期待されるレスポンス:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "<message-id@server>"
}
```

---

## 🔧 トラブルシューティング

### 問題1: ポート3001が使用中

```bash
# ポート使用状況を確認
sudo lsof -i :3001

# プロセスを終了
sudo kill -9 <PID>
```

### 問題2: SMTP接続エラー

```bash
# VPSからXserver SMTPへの接続確認
telnet sv10210.xserver.jp 587

# ポート587が開いているか確認
sudo firewall-cmd --list-ports  # CentOS/RHEL
sudo ufw status                 # Ubuntu/Debian
```

### 問題3: Nginx 502 Bad Gateway

```bash
# PM2のステータスを確認
pm2 status

# サーバーが起動しているか確認
curl http://127.0.0.1:3001/api/health

# Nginxエラーログを確認
sudo tail -f /var/log/nginx/error.log
```

### 問題4: メールが送信されない

```bash
# PM2ログを確認
pm2 logs email-api

# .env ファイルの設定を確認
cat ~/email-api/.env
```

---

## 📊 監視とメンテナンス

### PM2コマンド

```bash
# ステータス確認
pm2 status

# ログ確認（リアルタイム）
pm2 logs email-api

# サーバー再起動
pm2 restart email-api

# サーバー停止
pm2 stop email-api

# サーバー削除
pm2 delete email-api

# 詳細情報
pm2 show email-api
```

### ログローテーション

PM2のログローテーション設定:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 🔐 セキュリティ強化（オプション）

### API Key認証の追加

より高いセキュリティが必要な場合、API Key認証を追加できます:

```javascript
// vps-email-api.js の /api/send-email エンドポイントに追加

app.post('/api/send-email', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.VPS_API_KEY;

  if (validKey && apiKey !== validKey) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  next();
}, async (req, res) => {
  // 既存のコード
});
```

`.env` に追加:
```env
VPS_API_KEY=your-secure-api-key-here
```

Render.com側の `email-service.js` を修正:
```javascript
const response = await axios.post(
  `${VPS_API_URL}/api/send-email`,
  { ... },
  {
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.VPS_API_KEY
    }
  }
);
```

---

## ✅ デプロイ完了チェックリスト

- [ ] VPSにSSH接続可能
- [ ] vps-email-api.js をアップロード
- [ ] .env ファイルを設定
- [ ] npm install で依存関係をインストール
- [ ] node vps-email-api.js でテスト起動成功
- [ ] PM2で常駐化設定
- [ ] Nginxリバースプロキシ設定
- [ ] ヘルスチェックAPIが応答
- [ ] メール送信テストが成功
- [ ] Render.comからのメール送信が成功

---

## 📞 サポート

問題が発生した場合は、以下のログを確認してください:

1. PM2ログ: `pm2 logs email-api`
2. Nginxエラーログ: `/var/log/nginx/error.log`
3. システムログ: `journalctl -xe`

デプロイが完了したら、Render.com側からメール送信をテストしてください。
