# Gmail SMTP設定ガイド

## 概要

このシステムでは、メール認証コード（OTP）をGmail経由で送信することができます。
既に実装されている認証システムで使用するSMTPサーバーをGmailに変更する手順を説明します。

---

## 既に実装済みの機能

✅ **1. 顧客認証フロー**
- メールアドレス入力画面（login.html）
- Shopify顧客データベースで存在確認（email-auth.js）
- 既存顧客の場合のみ認証プロセス継続

✅ **2. OTP送信**
- Nodemailerを使用したメール送信（email-auth.js）
- 6桁の数字コード自動生成
- **10分間**の有効期限設定（※ユーザーリクエストは5分だが、現在は10分に設定）

✅ **3. 認証検証**
- OTP入力画面（login.html）
- コード検証とセッション確立（email-auth.js）
- Shopify顧客情報の取得と保存

---

## Gmail SMTP設定手順

### ステップ1: Googleアカウントで2段階認証を有効化

1. https://myaccount.google.com/security にアクセス
2. 「2段階認証プロセス」をクリック
3. まだ有効になっていない場合は、有効化する

### ステップ2: Googleアプリパスワードを生成

1. https://myaccount.google.com/apppasswords にアクセス
2. 「アプリを選択」で「メール」を選択
3. 「デバイスを選択」で「その他（名前を入力）」を選択
4. 名前を入力（例：`PSA代行サービス`）
5. 「生成」をクリック
6. **16桁のアプリパスワード**が表示されるのでコピー（例：`abcd efgh ijkl mnop`）
7. このパスワードは一度しか表示されないので必ず保存する

### ステップ3: 環境変数を更新

#### ローカル開発環境 (.env ファイル)

`.env` ファイルのSMTP設定を以下のように変更：

```env
# Gmail SMTP設定
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=あなたのGmailアドレス@gmail.com
SMTP_PASS=abcdefghijklmnop
FROM_EMAIL=あなたのGmailアドレス@gmail.com
ADMIN_EMAIL=あなたのGmailアドレス@gmail.com
MAIL_DEBUG=false
```

**重要**:
- `SMTP_PASS`にはスペースを含めずに16桁を入力（例：`abcdefghijklmnop`）
- `SMTP_USER`と`FROM_EMAIL`には同じGmailアドレスを使用

#### 本番環境 (Render.com)

Renderダッシュボードで環境変数を更新：

1. https://dashboard.render.com にアクセス
2. `new-daiko-form` サービスをクリック
3. 左メニュー「Environment」をクリック
4. 以下の環境変数を**更新**：

| Key | Value |
|-----|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | あなたのGmailアドレス@gmail.com |
| `SMTP_PASS` | 16桁のアプリパスワード（スペースなし） |
| `FROM_EMAIL` | あなたのGmailアドレス@gmail.com |
| `ADMIN_EMAIL` | あなたのGmailアドレス@gmail.com |

5. 「Save Changes」をクリック（自動的に再デプロイされます）

---

## テスト方法

### ローカル環境でテスト

1. サーバーを起動:
   ```bash
   npm start
   ```

2. ブラウザで `http://localhost:3000/login.html` にアクセス

3. Shopifyに登録されているメールアドレスを入力

4. 「認証コードを送信」ボタンをクリック

5. Gmailに6桁の認証コードが届く

6. コードを入力してログイン

### 本番環境でテスト

1. `https://daiko.kanucard.com/login.html` にアクセス

2. Shopifyに登録されているメールアドレスを入力

3. 「認証コードを送信」ボタンをクリック

4. Gmailに6桁の認証コードが届く

5. コードを入力してログイン

---

## 送信されるメールの内容

```
件名: 【PSA代行サービス】認証コード

本文:

認証コード

以下の認証コードを入力してログインを完了してください。

123456

このコードの有効期限は10分間です。
心当たりがない場合は、このメールを無視してください。
```

---

## トラブルシューティング

### エラー: "Invalid login: 535-5.7.8 Username and Password not accepted"

**原因**:
- アプリパスワードが間違っている
- 通常のGoogleアカウントパスワードを使用している

**解決方法**:
- 正しい16桁のアプリパスワードを使用
- スペースを含めずに入力（例：`abcdefghijklmnop`）
- 新しいアプリパスワードを生成して再試行

### エラー: "Connection timeout"

**原因**:
- SMTPポートがブロックされている
- ネットワーク接続の問題

**解決方法**:
- ポート587が開いているか確認
- ファイアウォール設定を確認
- ポート465（SSL/TLS）を試す：
  ```env
  SMTP_PORT=465
  ```

### エラー: "メール送信に失敗しました"

**原因**:
- SMTP設定が間違っている
- Gmailアカウントの問題

**解決方法**:
1. `.env`ファイルの設定を再確認
2. `MAIL_DEBUG=true`に設定してログを確認
3. Googleアカウントのセキュリティ設定を確認
4. 2段階認証が有効になっているか確認

### メールが届かない

**原因**:
- メールがスパムフォルダに入っている
- メールアドレスが間違っている

**解決方法**:
1. スパムフォルダを確認
2. 正しいメールアドレスを入力
3. Gmail以外のメールアドレスの場合、受信設定を確認

---

## Gmail送信制限

Gmailには1日あたりの送信制限があります：

- **無料Gmailアカウント**: 1日500通
- **Google Workspaceアカウント**: 1日2,000通

この制限を超える場合は、SendGrid、Mailgun、AWS SESなどのメール送信サービスの使用を検討してください。

---

## セキュリティのベストプラクティス

1. **アプリパスワードの管理**
   - アプリパスワードは絶対に公開しない
   - GitHubなどにコミットしない
   - 定期的に変更する

2. **.envファイルの保護**
   - `.gitignore`に`.env`が含まれていることを確認
   - 本番環境では環境変数として設定

3. **不正使用の監視**
   - Gmail送信履歴を定期的に確認
   - 不審な送信があればアプリパスワードを無効化

---

## OTP有効期限を5分に変更する方法

現在、OTPの有効期限は10分に設定されていますが、5分に変更したい場合：

### email-auth.js を編集

```javascript
// 行73: 10分 → 5分に変更
const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5分後に期限切れ
```

変更後：
1. ファイルを保存
2. サーバーを再起動
3. 変更をコミット＆デプロイ

---

## その他のSMTPサーバーオプション

### SendGrid（推奨 - 本番環境）

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
```

### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
FROM_EMAIL=noreply@yourdomain.com
```

### AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
FROM_EMAIL=noreply@yourdomain.com
```

---

## サポート

問題が解決しない場合は、ログを確認してください：

```bash
# ローカル環境
npm start

# デバッグモード有効化
MAIL_DEBUG=true npm start
```

ログには以下のような情報が表示されます：

- `[Email Auth] SMTP config: {...}`
- `[Email Auth] Attempting to send email with config: {...}`
- `[Email Auth] Email sent successfully to: xxx`

エラーが発生している場合は、詳細なエラーメッセージが表示されます。
