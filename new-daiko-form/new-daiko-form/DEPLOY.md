# デプロイガイド

このドキュメントでは、PSA代行統合システムをオンラインでホスティングする方法を説明します。

## 🚀 推奨デプロイ方法

### オプション1: Render.com（無料・推奨）

**特徴:**
- ✅ 無料プランあり
- ✅ 自動SSL証明書
- ✅ カスタムドメイン対応
- ✅ GitHubと連携して自動デプロイ

**手順:**

1. **Renderアカウント作成**
   - https://render.com にアクセス
   - GitHubアカウントでサインアップ

2. **新規Web Service作成**
   - ダッシュボードで「New +」→「Web Service」をクリック
   - GitHubリポジトリ `KentaroKojima0029/new-daiko-form` を選択

3. **設定**
   ```
   Name: psa-daiko-service
   Region: Singapore (または Tokyo)
   Branch: master
   Build Command: npm install
   Start Command: npm start
   ```

4. **環境変数設定（完全版の場合）**

   完全版（メール送信・データベース機能付き）を使う場合は、以下の環境変数を追加：

   ```
   SMTP_HOST=sv10210.xserver.jp
   SMTP_PORT=587
   SMTP_USER=collection@kanucard.com
   SMTP_PASS=your_password_here
   FROM_EMAIL=collection@kanucard.com
   ADMIN_EMAIL=collection@kanucard.com
   ADMIN_USER=admin
   ADMIN_PASSWORD=#collection30
   ```

   静的版（HTMLのみ表示）の場合は環境変数不要です。

5. **デプロイ**
   - 「Create Web Service」をクリック
   - 自動的にビルド・デプロイが開始されます

6. **カスタムドメイン設定**
   - デプロイ完了後、「Settings」→「Custom Domains」
   - 「Add Custom Domain」をクリック
   - `daiko.kanucard.com` を入力
   - 表示されるCNAMEレコードをドメインのDNS設定に追加

   **DNS設定例:**
   ```
   Type: CNAME
   Name: daiko
   Value: psa-daiko-service.onrender.com (Renderが指定する値)
   TTL: 3600
   ```

7. **SSL証明書**
   - Renderが自動的にLet's Encrypt証明書を発行
   - HTTPSが自動有効化

---

### オプション2: Railway（無料枠あり）

**手順:**

1. https://railway.app にアクセス
2. GitHubでログイン
3. 「Deploy from GitHub repo」を選択
4. `KentaroKojima0029/new-daiko-form` を選択
5. 環境変数を設定（完全版の場合）
6. 自動デプロイ
7. カスタムドメイン設定

---

### オプション3: Heroku（有料）

**手順:**

1. https://heroku.com にアクセス
2. 新規アプリ作成
3. GitHubと連携
4. リポジトリを選択
5. 環境変数を設定
6. デプロイ

---

## 📝 デプロイ後の確認

### 1. サーバーの起動確認

デプロイ完了後、以下のURLにアクセス：

- `https://your-app.onrender.com/` - トップページ
- `https://your-app.onrender.com/user` - 利用者ページ
- `https://your-app.onrender.com/admin` - 管理者ダッシュボード

### 2. カスタムドメインの確認

DNS設定反映後（数分〜48時間）：

```bash
# DNS確認
nslookup daiko.kanucard.com

# HTTPSアクセス確認
curl -I https://daiko.kanucard.com
```

---

## 🔧 2つのサーバー版の違い

### **静的版（server.js）**- デフォルト

```bash
npm start
```

**機能:**
- ✅ HTMLページの表示
- ✅ 静的ファイル配信
- ❌ メール送信
- ❌ データベース
- ❌ API機能

**用途:**
- デモ・プレビュー
- デザイン確認
- 軽量ホスティング

---

### **完全版（integrated_server.js）**

```bash
npm run full
```

**機能:**
- ✅ 全機能動作
- ✅ メール送信
- ✅ データベース（JSON）
- ✅ API
- ✅ リアルタイム通信

**用途:**
- 本番運用
- 完全なシステム

**必要な設定:**
- 環境変数（.env）
- SSL証明書
- SMTP設定

---

## 🌐 GitHub Pagesについて

GitHub Pagesは**静的サイト専用**です。

**制限事項:**
- ❌ Node.jsサーバーは動作しない
- ❌ APIエンドポイントは動作しない
- ❌ メール送信は動作しない
- ✅ HTMLファイルの表示のみ可能

**GitHub Pagesで動作するもの:**
- `index.html`（ルートの情報ページ）
- 静的なHTMLファイル
- CSS、JavaScript（フロントエンドのみ）

---

## 📊 推奨デプロイ構成

### **本番環境**

```
Render.com
├── 完全版サーバー（npm run full）
├── カスタムドメイン（daiko.kanucard.com）
├── 環境変数設定
└── 自動SSL
```

### **開発・テスト環境**

```
ローカル
├── 静的版（npm start）
└── 完全版（npm run full）
```

### **デモ・プレビュー**

```
GitHub Pages
└── 情報ページのみ（index.html）
```

---

## 🐛 トラブルシューティング

### デプロイエラー

```bash
# ビルドログを確認
# Renderダッシュボードの「Logs」タブ

# ローカルで確認
npm install
npm start
```

### 環境変数エラー

完全版を使う場合、すべての環境変数が設定されているか確認：

```
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
FROM_EMAIL
ADMIN_EMAIL
ADMIN_USER
ADMIN_PASSWORD
```

### ポートエラー

Renderは自動的に`PORT`環境変数を設定します。
`server.js`では`process.env.PORT`を使用しているため、自動対応します。

---

## 📞 サポート

問題が発生した場合：

1. ログを確認
2. 環境変数を確認
3. ローカルで動作確認
4. GitHubのIssuesで報告

---

**最終更新**: 2025年10月7日
