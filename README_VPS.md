# Xserver VPS デプロイメントガイド

このドキュメントは、PSA代行買取承認システムをXserver VPSにデプロイする手順を説明します。

## 📋 目次

1. [前提条件](#前提条件)
2. [VPSサーバーの準備](#vpsサーバーの準備)
3. [アプリケーションのデプロイ](#アプリケーションのデプロイ)
4. [環境変数の設定](#環境変数の設定)
5. [サーバーの起動](#サーバーの起動)
6. [SSL/HTTPS設定](#sslhttps設定)
7. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

- Xserver VPSアカウント
- SSHクライアント（ターミナル、PuTTYなど）
- Node.js 18以上
- Shopify Admin APIアクセストークン
- Xserverメール設定（SMTP）

---

## VPSサーバーの準備

### 1. VPSサーバーへのSSH接続

```bash
ssh root@your-vps-ip-address
```

### 2. システムのアップデート

```bash
# パッケージリストを更新
apt update

# システムをアップグレード
apt upgrade -y
```

### 3. Node.jsのインストール

```bash
# Node.js 18をインストール（LTS版）
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# バージョン確認
node --version
npm --version
```

### 4. PM2のインストール（プロセス管理ツール）

```bash
npm install -g pm2

# システム起動時にPM2を自動起動
pm2 startup systemd
```

### 5. Gitのインストール

```bash
apt install -y git
```

---

## アプリケーションのデプロイ

### 1. アプリケーションディレクトリの作成

```bash
mkdir -p /var/www
cd /var/www
```

### 2. Gitリポジトリのクローン

```bash
# xserver-vpsブランチをクローン
git clone -b xserver-vps https://github.com/KentaroKojima0029/new-daiko-form.git psa-api
cd psa-api
```

### 3. 依存パッケージのインストール

```bash
npm install --production
```

---

## 環境変数の設定

### 1. .envファイルの作成

```bash
# .env.productionをコピーして.envを作成
cp .env.production .env
```

### 2. .envファイルの編集

```bash
nano .env
```

以下の重要な環境変数を設定してください：

```env
# ===== サーバー設定 =====
NODE_ENV=production
PORT=3000

# ===== 管理者認証 =====
ADMIN_USER=admin
ADMIN_PASSWORD=#collection30

# ===== SMTP設定（Xserver） =====
SMTP_HOST=sv10210.xserver.jp
SMTP_PORT=587
SMTP_USER=collection@kanucard.com
SMTP_PASS=Kanu29012300
FROM_EMAIL=collection@kanucard.com
ADMIN_EMAIL=collection@kanucard.com
MAIL_DEBUG=false

# ===== Shopify設定（必須） =====
# ⚠️ 重要: 実際のShopifyトークンに置き換えてください
SHOPIFY_SHOP_NAME=kanucard
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ===== CORS/管理画面設定 =====
ADMIN_ORIGIN=https://kanucard.com
ADMIN_API_URL=https://kanucard-daiko-support.onrender.com
```

### 3. Shopifyトークンの取得方法

1. Shopify管理画面にログイン
2. **設定** > **アプリと販売チャネル** > **アプリを開発する**
3. **カスタムアプリを作成**
4. **Admin API アクセストークン**を取得
5. 必要な権限を付与:
   - `read_customers`
   - `read_orders`
6. トークンを`.env`ファイルの`SHOPIFY_ADMIN_ACCESS_TOKEN`に貼り付け

### 4. 環境変数の確認

```bash
# .envファイルの内容を確認
cat .env

# 特にShopify設定を確認
grep SHOPIFY .env
```

---

## サーバーの起動

### 1. PM2でサーバーを起動

```bash
cd /var/www/psa-api

# サーバーを起動
pm2 start server.js --name psa-api

# 起動確認
pm2 status

# ログを確認
pm2 logs psa-api
```

### 2. PM2の自動起動設定

```bash
# 現在のPM2プロセスを保存
pm2 save

# システム起動時に自動起動
pm2 startup
```

### 3. サーバーの動作確認

```bash
# ヘルスチェックAPIを実行
curl http://localhost:3000/api/health

# Shopify接続テスト
curl http://localhost:3000/api/test/shopify
```

---

## SSL/HTTPS設定

### 1. Let's Encryptでの無料SSL証明書取得

```bash
# Certbotのインストール
apt install -y certbot

# SSL証明書の取得
certbot certonly --standalone -d your-domain.com
```

### 2. Nginxのインストール（リバースプロキシ）

```bash
apt install -y nginx
```

### 3. Nginx設定ファイルの作成

```bash
nano /etc/nginx/sites-available/psa-api
```

以下の内容を記述:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # HTTPからHTTPSへリダイレクト
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL証明書の設定
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # リバースプロキシ設定
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Nginxの有効化と起動

```bash
# シンボリックリンクを作成
ln -s /etc/nginx/sites-available/psa-api /etc/nginx/sites-enabled/

# Nginxの設定テスト
nginx -t

# Nginxを再起動
systemctl restart nginx

# Nginxを自動起動に設定
systemctl enable nginx
```

---

## PM2基本コマンド

```bash
# アプリケーション起動
pm2 start server.js --name psa-api

# アプリケーション停止
pm2 stop psa-api

# アプリケーション再起動
pm2 restart psa-api

# アプリケーション削除
pm2 delete psa-api

# ステータス確認
pm2 status

# ログ確認（リアルタイム）
pm2 logs psa-api

# ログ確認（過去ログ）
pm2 logs psa-api --lines 100

# プロセスのモニタリング
pm2 monit
```

---

## アップデート手順

アプリケーションを更新する場合:

```bash
cd /var/www/psa-api

# 最新のコードを取得
git pull origin xserver-vps

# 依存パッケージを更新
npm install --production

# PM2でアプリケーションを再起動
pm2 restart psa-api

# ログを確認
pm2 logs psa-api --lines 50
```

---

## トラブルシューティング

### Shopify環境変数エラー

**エラー**: `Shopify environment variables are missing`

**解決方法**:

```bash
# .envファイルを確認
cat .env | grep SHOPIFY

# SHOPIFY_SHOP_NAME と SHOPIFY_ADMIN_ACCESS_TOKEN が正しく設定されているか確認
# 空白や余分な文字がないか確認

# サーバーを再起動
pm2 restart psa-api
```

### メール送信エラー

**エラー**: `SMTP connection failed`

**解決方法**:

```bash
# SMTP設定を確認
cat .env | grep SMTP

# メールデバッグを有効化
nano .env
# MAIL_DEBUG=true に変更

# サーバー再起動
pm2 restart psa-api

# ログを確認
pm2 logs psa-api
```

### ポート競合エラー

**エラー**: `Error: listen EADDRINUSE: address already in use :::3000`

**解決方法**:

```bash
# ポート3000を使用しているプロセスを確認
lsof -i :3000

# プロセスを終了
kill -9 [PID]

# または別のポートを使用
nano .env
# PORT=3001 に変更
```

### データベースエラー

**エラー**: `Database connection failed`

**解決方法**:

```bash
# databaseディレクトリが存在するか確認
ls -la /var/www/psa-api/database

# ディレクトリがない場合は作成
mkdir -p /var/www/psa-api/database

# 権限を確認
chmod 755 /var/www/psa-api/database

# サーバー再起動
pm2 restart psa-api
```

---

## セキュリティ推奨事項

### 1. ファイアウォール設定

```bash
# UFWのインストール
apt install -y ufw

# SSH、HTTP、HTTPSを許可
ufw allow 22
ufw allow 80
ufw allow 443

# ファイアウォールを有効化
ufw enable

# ステータス確認
ufw status
```

### 2. 自動セキュリティアップデート

```bash
apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

### 3. ログローテーション

```bash
# PM2のログローテーション設定
pm2 install pm2-logrotate

# 設定
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## バックアップ

### データベースバックアップ

```bash
# バックアップスクリプトを作成
nano /var/www/psa-api/backup.sh
```

スクリプト内容:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/psa-api"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# データベースをバックアップ
cp /var/www/psa-api/database/production.db $BACKUP_DIR/production_$DATE.db

# 古いバックアップを削除（7日以上前）
find $BACKUP_DIR -name "production_*.db" -mtime +7 -delete

echo "Backup completed: production_$DATE.db"
```

実行権限を付与:

```bash
chmod +x /var/www/psa-api/backup.sh
```

Cronで自動バックアップ（毎日午前3時）:

```bash
crontab -e

# 以下を追加
0 3 * * * /var/www/psa-api/backup.sh >> /var/log/psa-backup.log 2>&1
```

---

## サポート

問題が発生した場合:

1. **ログを確認**: `pm2 logs psa-api`
2. **ヘルスチェック**: `curl http://localhost:3000/api/health`
3. **環境変数を確認**: `cat .env`
4. **GitHub Issuesで報告**: https://github.com/KentaroKojima0029/new-daiko-form/issues

---

## 関連ドキュメント

- [CLAUDE.md](./CLAUDE.md) - プロジェクト概要
- [ENV_SETUP.md](./ENV_SETUP.md) - 環境変数詳細
- [XSERVER_DEPLOY.md](./XSERVER_DEPLOY.md) - Xserverデプロイ情報

---

**最終更新**: 2025年10月13日
**バージョン**: 1.0.0
