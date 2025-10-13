# 買取管理画面 - Xserver デプロイメントガイド

## 📁 ファイル構成

```
xserver-admin/
├── index.html      # メインHTML（管理画面）
├── admin.css       # スタイルシート
├── admin.js        # JavaScript（ロジック・API通信）
├── config.js       # 設定ファイル
└── README.md       # このファイル
```

## 🚀 デプロイ手順

### 1. Xserverへのアップロード

1. FTPクライアント（FileZillaなど）でXserverに接続
2. 公開ディレクトリ（通常は `public_html/` または `www/`）にアクセス
3. 適切なディレクトリ（例: `public_html/kaitori-admin/`）を作成
4. 以下のファイルをアップロード：
   - index.html
   - admin.css
   - admin.js
   - config.js

### 2. 設定の確認

`config.js` ファイルを開き、以下の設定を確認：

```javascript
const CONFIG = {
    // Render APIエンドポイント
    API_BASE_URL: 'https://daiko.kanucard.com/api',

    // 承認ページURL
    APPROVAL_BASE_URL: 'https://daiko.kanucard.com/approval',

    // 管理者パスワード（必ず変更してください！）
    ADMIN_PASSWORD: 'kaitori_admin_2025',

    // その他の設定は通常変更不要
};
```

### 3. サーバー側CORS設定

Render側のサーバー（server.js）にXserverのドメインを追加：

```bash
# Renderの環境変数に追加
ADMIN_ORIGIN=https://your-xserver-domain.com
```

または、server.jsの`allowedOrigins`配列に直接追加：

```javascript
const allowedOrigins = [
    'https://daiko.kanucard.com',
    'http://localhost:3000',
    'https://your-xserver-domain.com',  // ← ここに追加
    process.env.ADMIN_ORIGIN
].filter(Boolean);
```

## 🔐 セキュリティ設定

### パスワードの変更（重要！）

1. `config.js`の`ADMIN_PASSWORD`を変更
2. 複雑なパスワードを設定（推奨: 12文字以上、英数字+記号）

```javascript
ADMIN_PASSWORD: 'your_secure_password_here_2025',
```

### HTTPS化の確認

- Xserverは標準でSSL対応
- 必ず `https://` でアクセスすること
- HTTP接続は推奨しません

## 📱 アクセス方法

デプロイ後、以下のURLでアクセス：

```
https://your-xserver-domain.com/kaitori-admin/
```

### ログイン情報

- **パスワード**: config.jsで設定したADMIN_PASSWORD
- **セッション有効期限**: 1時間（設定変更可能）

## 🛠️ 機能説明

### 新規作成タブ

買取依頼を作成し、顧客への承認URLを生成：

1. カード情報を入力（カード名、コンディション、画像URL）
2. 顧客情報を入力（名前、メール、電話）
3. 査定情報を入力（査定価格、査定者名、コメント）
4. 「作成 & URL生成」ボタンをクリック
5. 生成されたURLを顧客に送信

### 依頼一覧タブ

登録済みの買取依頼を一覧表示：

- **詳細ボタン**: 依頼の詳細情報を表示
- **URLボタン**: 承認URLを再表示・コピー
- ステータス表示:
  - 🟡 未回答（pending）
  - 🟢 承認（approved）
  - 🔴 拒否（rejected）

## 🔄 API連携

### エンドポイント

- `POST /api/kaitori/create` - 買取依頼作成
- `GET /api/kaitori/list` - 依頼一覧取得
- `GET /api/kaitori/detail/:id` - 依頼詳細取得

### エラーハンドリング

- タイムアウト: 30秒
- エラーメッセージは画面上部に表示
- ネットワークエラー時は自動リトライなし

## 🐛 トラブルシューティング

### ログインできない

- パスワードを確認
- ブラウザのキャッシュをクリア
- セッションストレージをクリア

### API通信エラー

1. **CORS エラー**
   - Render側の環境変数 `ADMIN_ORIGIN` を確認
   - サーバーログでCORS設定を確認

2. **タイムアウト**
   - Renderサーバーが起動しているか確認
   - ネットワーク接続を確認

3. **404 Not Found**
   - APIエンドポイントURLを確認
   - config.jsの`API_BASE_URL`を確認

### 依頼一覧が表示されない

- ブラウザのコンソールでエラーを確認
- Render側のデータベース接続を確認
- API通信が成功しているか確認（Network タブ）

## 📊 ブラウザ対応

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

（IE11は非対応）

## 🔧 カスタマイズ

### セッションタイムアウト変更

`config.js`:
```javascript
SESSION_TIMEOUT: 7200000, // 2時間に変更
```

### デバッグモード有効化

`config.js`:
```javascript
DEBUG: true, // ブラウザコンソールにログ出力
```

### スタイルのカスタマイズ

`admin.css`を編集して、色やレイアウトを変更可能：

```css
/* メインカラー変更例 */
.btn-primary {
    background: linear-gradient(135deg, #your-color-1, #your-color-2);
}
```

## 📞 サポート

問題が発生した場合：

1. ブラウザのコンソールログを確認
2. Render側のサーバーログを確認
3. 設定ファイル（config.js）を再確認
4. CORS設定を確認

---

**更新日**: 2025年10月9日
**バージョン**: 1.0.0
