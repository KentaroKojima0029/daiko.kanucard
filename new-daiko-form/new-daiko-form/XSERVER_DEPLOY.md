# Xserver VPSデプロイガイド

## 📋 前提条件

- Xserver VPSプランに契約
- SSH接続情報（IPアドレス、ユーザー名、パスワード）
- Node.js 18.x以上がインストール済み

---

## 🚀 デプロイ手順

### ステップ1: SSH接続

```bash
# VPSに接続
ssh username@your-vps-ip-address

# rootユーザーに切り替え（必要な場合）
sudo su -
```

### ステップ2: Node.jsのインストール（未インストールの場合）

```bash
# Node.js 20.x LTSのインストール
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

# バージョン確認
node -v
npm -v
```

### ステップ3: アプリケーションのデプロイ

```bash
# アプリケーション用ディレクトリ作成
mkdir -p /var/www/daiko-app
cd /var/www/daiko-app

# GitHubからクローン
git clone https://github.com/KentaroKojima0029/new-daiko-form.git .

# 依存パッケージのインストール
npm install --production
```

### ステップ4: 環境変数の設定

```bash
# .envファイルを作成
nano .env
```

以下の内容を貼り付け：

```env
# Node.js環境
NODE_ENV=production
PORT=3000

# Shopify設定
SHOPIFY_SHOP_NAME=kanucard
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# JWT/セッション
JWT_SECRET=your-random-secret-here
SESSION_SECRET=your-random-secret-here

# SMTP設定（Xserver）
SMTP_HOST=sv10210.xserver.jp
SMTP_PORT=587
SMTP_USER=collection@kanucard.com
SMTP_PASS=Kanu29012300
FROM_EMAIL=collection@kanucard.com
ADMIN_EMAIL=collection@kanucard.com

# メール設定
MAIL_DEBUG=false
```

保存: `Ctrl + X` → `Y` → `Enter`

**セキュアな秘密鍵の生成:**
```bash
# JWT_SECRET生成
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# SESSION_SECRET生成
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### ステップ5: PM2でアプリケーションを常駐化

```bash
# PM2のインストール（グローバル）
npm install -g pm2

# アプリケーション起動
pm2 start server.js --name daiko-app

# 自動起動設定
pm2 startup
pm2 save

# 起動確認
pm2 status
pm2 logs daiko-app
```

**PM2の便利なコマンド:**
```bash
pm2 restart daiko-app   # 再起動
pm2 stop daiko-app      # 停止
pm2 delete daiko-app    # 削除
pm2 logs daiko-app      # ログ確認
pm2 monit               # リアルタイムモニタリング
```

### ステップ6: Nginxリバースプロキシ設定

```bash
# Nginxインストール（未インストールの場合）
dnf install -y nginx

# 設定ファイル作成
nano /etc/nginx/conf.d/daiko.conf
```

以下の内容を貼り付け：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # ドメインに置き換え

    # セキュリティヘッダー
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

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

```bash
# Nginx設定テスト
nginx -t

# Nginx起動・自動起動設定
systemctl start nginx
systemctl enable nginx
systemctl status nginx
```

### ステップ7: SSL/HTTPS設定（Let's Encrypt）

```bash
# Certbotインストール
dnf install -y certbot python3-certbot-nginx

# SSL証明書取得
certbot --nginx -d your-domain.com

# 自動更新設定確認
systemctl status certbot-renew.timer
```

### ステップ8: ファイアウォール設定

```bash
# HTTPとHTTPSを許可
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# 設定確認
firewall-cmd --list-all
```

---

## 🔄 GitHubからの更新手順

コードを更新した場合：

```bash
# VPSに接続
ssh username@your-vps-ip-address
cd /var/www/daiko-app

# GitHubから最新版を取得
git pull origin main

# 依存パッケージを更新（package.jsonが変更された場合）
npm install --production

# PM2でアプリケーションを再起動
pm2 restart daiko-app

# ログで起動確認
pm2 logs daiko-app
```

**簡単な更新スクリプト:**

```bash
# deploy.sh を作成
nano /var/www/daiko-app/deploy.sh
```

内容:
```bash
#!/bin/bash
cd /var/www/daiko-app
git pull origin main
npm install --production
pm2 restart daiko-app
pm2 logs daiko-app --lines 50
```

実行権限付与:
```bash
chmod +x /var/www/daiko-app/deploy.sh
```

使用方法:
```bash
/var/www/daiko-app/deploy.sh
```

---

## 🔧 トラブルシューティング

### アプリケーションが起動しない

```bash
# ログ確認
pm2 logs daiko-app --lines 100

# 環境変数確認
cat /var/www/daiko-app/.env

# ポート使用状況確認
netstat -tuln | grep 3000

# 手動起動テスト
cd /var/www/daiko-app
node server.js
```

### Nginxエラー

```bash
# Nginxエラーログ確認
tail -f /var/log/nginx/error.log

# 設定テスト
nginx -t

# Nginx再起動
systemctl restart nginx
```

### ファイアウォールで接続できない

```bash
# ファイアウォール状態確認
firewall-cmd --list-all

# HTTP/HTTPS許可
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

### SSL証明書エラー

```bash
# 証明書確認
certbot certificates

# 証明書更新
certbot renew --dry-run
certbot renew
```

---

## 📊 モニタリングとログ

### PM2モニタリング

```bash
# リアルタイムモニタリング
pm2 monit

# メモリ・CPU使用状況
pm2 status
```

### アプリケーションログ

```bash
# PM2ログ
pm2 logs daiko-app

# アプリケーションログファイル
tail -f /var/www/daiko-app/logs/combined-$(date +%Y-%m-%d).log
tail -f /var/www/daiko-app/logs/error-$(date +%Y-%m-%d).log
```

### Nginxログ

```bash
# アクセスログ
tail -f /var/log/nginx/access.log

# エラーログ
tail -f /var/log/nginx/error.log
```

---

## 🔒 セキュリティ設定

### SSH鍵認証の設定

```bash
# ローカルマシンでSSH鍵を生成
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 公開鍵をVPSにコピー
ssh-copy-id username@your-vps-ip-address

# VPS側でパスワード認証を無効化
sudo nano /etc/ssh/sshd_config

# 以下の行を変更
PasswordAuthentication no

# SSH再起動
sudo systemctl restart sshd
```

### 自動セキュリティアップデート

```bash
# DNF自動更新設定
dnf install -y dnf-automatic
systemctl enable --now dnf-automatic.timer
```

---

## 📱 ドメイン設定（Xserverドメイン）

Xserverで取得したドメインを使う場合：

1. **Xserverサーバーパネル**にログイン
2. **DNS設定**を開く
3. **Aレコード**を追加:
   ```
   ホスト名: @ または daiko
   値: VPSのIPアドレス
   TTL: 3600
   ```
4. 反映を待つ（数分〜48時間）

### DNS確認

```bash
# ローカルマシンで確認
nslookup your-domain.com
dig your-domain.com
```

---

## ✅ デプロイ完了後の確認

### 1. ヘルスチェック

```bash
curl https://your-domain.com/api/health
```

### 2. メール認証テスト

```bash
# ログイン画面にアクセス
https://your-domain.com/login.html

# メールアドレス入力
# 認証コードが届くか確認
```

### 3. Shopify連携テスト

```bash
curl https://your-domain.com/api/test/shopify
```

---

## 📞 サポート

問題が発生した場合:

1. PM2ログを確認: `pm2 logs daiko-app`
2. Nginxログを確認: `tail -f /var/log/nginx/error.log`
3. アプリケーションログを確認: `tail -f /var/www/daiko-app/logs/error-*.log`

---

**最終更新:** 2025年10月8日
**作成者:** Claude Code
