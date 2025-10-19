# Render.com 本番環境デプロイメントガイド

## 📋 必要な環境変数

Renderダッシュボードの「Environment」タブで以下の環境変数を設定してください。

### 1. Node.js環境設定
```
NODE_ENV=production
PORT=3000
```

### 2. Shopify設定（必須）
```
SHOPIFY_SHOP_NAME=kanucard
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**注意:** 実際のShopify Admin Access Tokenに置き換えてください

**注意事項:**
- `SHOPIFY_SHOP_NAME`には`.myshopify.com`を除いたショップ名のみを入力
- Shopify Admin APIアクセストークンは「Custom apps」から取得
- 必要な権限: `read_customers`, `read_orders`

### 3. JWT/セッション設定（必須）
```
JWT_SECRET=[強力なランダム文字列を生成してください]
SESSION_SECRET=[別の強力なランダム文字列を生成してください]
```

**セキュアな秘密鍵の生成方法:**
```bash
# macOS/Linux
openssl rand -base64 32

# または Node.jsで
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. SMS認証設定（Twilio - オプション）

開発環境では認証コードがログに出力されますが、本番環境でSMS送信を有効にする場合:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+815012345678
```

**Twilioアカウント設定:**
1. [Twilio Console](https://www.twilio.com/console) にアクセス
2. Account SIDとAuth Tokenを取得
3. SMS送信用の電話番号を購入（日本の番号推奨）
4. 環境変数に設定

**注意:** Twilioが未設定の場合、認証コードはサーバーログに出力されます（開発モード）

### 5. メール送信設定（既存 - Xserver SMTP）
```
SMTP_HOST=sv10210.xserver.jp
SMTP_PORT=587
SMTP_USER=collection@kanucard.com
SMTP_PASS=Kanu29012300
FROM_EMAIL=collection@kanucard.com
ADMIN_EMAIL=contact@kanucard.com
MAIL_DEBUG=false
```

## 🚀 Renderデプロイ手順

### ステップ1: Renderでサービスを作成

1. [Render Dashboard](https://dashboard.render.com/) にログイン
2. 「New +」→「Web Service」を選択
3. GitHubリポジトリを接続: `KentaroKojima0029/new-daiko-form`
4. 以下の設定を入力:
   - **Name**: `psa-daiko-service`（任意）
   - **Region**: Singapore (東京に最も近い)
   - **Branch**: `main`
   - **Root Directory**: （空欄のまま）
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free または有料プラン

### ステップ2: 環境変数を設定

1. サービスページの「Environment」タブを開く
2. 上記の「必要な環境変数」をすべて追加
3. 「Save Changes」をクリック

### ステップ3: デプロイを実行

1. 「Manual Deploy」→「Deploy latest commit」をクリック
2. ビルドログを確認
3. デプロイが完了したら「Logs」タブで起動ログを確認

## ✅ デプロイ後の確認

### 1. ヘルスチェック

デプロイ後、以下のURLにアクセスしてシステムの状態を確認:

```
https://your-app-name.onrender.com/api/health
```

**期待される応答:**
```json
{
  "status": "healthy",
  "checks": {
    "shopify": { "overall": "success" },
    "database": { "overall": "success" }
  },
  "message": "システムは正常に動作しています"
}
```

### 2. Shopify接続テスト

```
https://your-app-name.onrender.com/api/test/shopify
```

### 3. データベーステスト

```
https://your-app-name.onrender.com/api/test/database
```

## 🔒 セキュリティ設定

本番環境では以下が自動的に有効になります:

- ✅ **HTTPSの強制** (Strict-Transport-Security)
- ✅ **CSP (Content Security Policy)**
- ✅ **XSS保護ヘッダー**
- ✅ **レート制限**
  - 一般API: 15分で100リクエスト
  - 認証API: 15分で5リクエスト
  - 認証コード検証: 10分で5リクエスト
- ✅ **セキュアなCookie設定**
- ✅ **リクエストログ記録**

## 📊 ログとモニタリング

### ログの確認方法

Renderダッシュボードの「Logs」タブで以下を確認できます:

- **[INFO]** 通常の動作ログ
- **[WARN]** 警告（認証失敗など）
- **[ERROR]** エラー発生時のスタックトレース
- **[SECURITY]** セキュリティ関連イベント

### ログファイル

本番環境では `/logs` ディレクトリに以下のログが記録されます:

- `error-YYYY-MM-DD.log` - エラーログ
- `warn-YYYY-MM-DD.log` - 警告ログ
- `info-YYYY-MM-DD.log` - 情報ログ
- `security-YYYY-MM-DD.log` - セキュリティログ
- `combined-YYYY-MM-DD.log` - すべてのログ

**注意:** Render Freeプランでは永続化ストレージがないため、ログは一時的です。必要に応じて外部ログサービス（LogDNA, Papertrailなど）の利用を検討してください。

## 🗄️ データベース

### SQLite（デフォルト）

プロジェクトではSQLite（`daiko.db`）を使用しています。

**重要な注意事項:**
- Render Freeプランでは、サービスが再起動するとSQLiteデータは失われます
- 本番環境では、PostgreSQLなどの永続化データベースへの移行を推奨します

### PostgreSQLへの移行（推奨）

本番環境で永続化が必要な場合:

1. RenderでPostgreSQLデータベースを作成
2. 環境変数に`DATABASE_URL`を追加
3. `database.js`をPostgreSQL対応に変更

## 🔧 トラブルシューティング

### 問題: ヘルスチェックが失敗する

**確認項目:**
1. 環境変数が正しく設定されているか確認
2. ログで具体的なエラーメッセージを確認
3. Shopifyアクセストークンの有効期限を確認

### 問題: SMS認証コードが送信されない

**原因:**
- Twilio設定が未完了の場合、開発モードで動作します
- 認証コードはサーバーログに出力されます

**解決策:**
1. Renderの「Logs」タブで認証コードを確認
2. 本番でSMS送信を有効にする場合、Twilio設定を追加

### 問題: 認証後にログアウトされる

**原因:**
- Cookie設定が正しくない可能性

**解決策:**
1. `NODE_ENV=production`が設定されているか確認
2. HTTPSが有効になっているか確認（RenderはデフォルトでHTTPS）

### 問題: データベースエラー

**原因:**
- サービス再起動でSQLiteデータが失われた

**解決策:**
- `/api/test/database`でテーブル構造を確認
- 必要に応じてデータベースを再初期化

## 📱 カスタムドメインの設定

Renderでカスタムドメインを使用する場合:

1. Renderダッシュボードの「Settings」→「Custom Domains」
2. ドメインを追加（例: `daiko.kanucard.com`）
3. DNS設定でCNAMEレコードを追加:
   ```
   CNAME daiko your-app-name.onrender.com
   ```
4. SSL証明書は自動的に発行されます

## 🔄 継続的デプロイ

GitHubの`main`ブランチにプッシュすると、Renderが自動的にデプロイを実行します。

**デプロイフロー:**
1. コードをGitHubにプッシュ
2. Renderが自動的にビルド開始
3. `npm install`実行
4. `npm start`でサービス起動
5. ヘルスチェックが成功したらトラフィック切り替え

## 📞 サポート

問題が発生した場合:

1. Renderの「Logs」タブでエラーログを確認
2. `/api/health`でシステムステータスを確認
3. 必要に応じてRenderサポートに問い合わせ

---

**最終更新:** 2025年10月
**作成者:** Claude Code
