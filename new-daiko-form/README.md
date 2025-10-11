# PSA代行統合システム

トレーディングカードのPSA鑑定代行と買取承認を統合管理するWebシステム

## 🚀 主な機能

### 利用者向け機能
- 📦 **代行依頼フォーム** - カード情報、予算、希望条件を入力して依頼
- 📊 **進捗状況リアルタイム表示** - マイページで常に最新の進捗を確認
- 💬 **メッセージ機能** - 代行者との直接やり取り
- ✅ **買取承諾フォーム** - カードごとに承認・拒否・保留を選択

### 管理者向け機能
- 📈 **統合ダッシュボード** - 全案件の状況を一目で把握
- 📦 **代行案件管理** - 顧客依頼の管理とステータス更新
- ✅ **買取案件管理** - 買取承認の送信と回答管理
- 💬 **メッセージ管理** - 顧客とのメッセージ管理

### システム機能
- 💾 **自動バックアップ** - 1時間ごとの自動バックアップ（7日間保存）
- 📧 **メール通知** - 各種通知の自動送信
- 🌙 **ダークモード** - 目に優しいダークテーマ対応
- 📱 **レスポンシブデザイン** - PC・タブレット・スマホ対応

## 📁 プロジェクト構造

```
new-daiko-form/
├── src/
│   ├── server/
│   │   └── integrated_server.js      # メインサーバー
│   ├── client/
│   │   ├── user/                      # 利用者向けUI
│   │   │   ├── html/
│   │   │   │   ├── index.html        # 代行依頼フォーム
│   │   │   │   └── mypage.html       # マイページ
│   │   │   ├── css/
│   │   │   │   └── style.css         # スタイルシート
│   │   │   └── js/
│   │   │       ├── request.js        # 依頼フォームロジック
│   │   │       └── mypage.js         # マイページロジック
│   │   ├── admin/                     # 管理者向けUI
│   │   │   ├── html/
│   │   │   │   └── dashboard.html    # 統合ダッシュボード
│   │   │   ├── css/
│   │   │   │   └── dashboard.css     # ダッシュボードスタイル
│   │   │   └── js/
│   │   │       └── dashboard.js      # ダッシュボードロジック
│   │   └── customer/                  # 顧客承認画面（既存）
│   │       ├── html/
│   │       │   └── index.html
│   │       ├── css/
│   │       │   └── customer.css
│   │       └── js/
│   ├── config/
│   │   ├── .env                       # 環境変数
│   │   ├── server.key                 # SSL秘密鍵
│   │   └── server.crt                 # SSL証明書
│   └── data/
│       ├── agency_requests.json       # 代行依頼データ
│       ├── approval_requests.json     # 買取承認データ
│       ├── messages.json              # メッセージデータ
│       └── backups/                   # バックアップディレクトリ
├── package.json
└── README.md
```

## 🔧 セットアップ

### 1. 依存パッケージのインストール

```bash
cd new-daiko-form
npm install
```

### 2. 環境変数の設定

`src/config/.env` ファイルを作成し、以下の内容を設定：

```env
# サーバー設定
HTTP_PORT=3000
HTTPS_PORT=3443

# 管理者認証
ADMIN_USER=admin
ADMIN_PASSWORD=#collection30

# SMTP設定（メール送信）
SMTP_HOST=sv10210.xserver.jp
SMTP_PORT=587
SMTP_USER=collection@kanucard.com
SMTP_PASS=Kanu29012300
FROM_EMAIL=collection@kanucard.com
ADMIN_EMAIL=collection@kanucard.com
MAIL_DEBUG=false
```

### 3. SSL証明書の生成（開発環境）

```bash
cd src/config
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes \
  -subj "/C=JP/ST=Tokyo/L=Tokyo/O=PSA Agency/CN=localhost"
```

## 🏃‍♂️ 起動方法

### 開発環境

```bash
npm run dev
```

### 本番環境

```bash
npm start
```

サーバーが起動したら、以下のURLにアクセス：

- **利用者向けページ**: http://localhost:3000/
- **管理者ダッシュボード**: http://localhost:3000/admin
  - ユーザー名: `admin`
  - パスワード: `#collection30`

## 📖 使用方法

### 利用者側の流れ

1. **代行依頼**
   - http://localhost:3000/ にアクセス
   - カード情報と希望条件を入力
   - 「代行依頼を送信」ボタンをクリック

2. **確認メール受信**
   - 入力したメールアドレスに確認メールが届く
   - マイページURLが記載されている

3. **マイページで進捗確認**
   - マイページURLにアクセス
   - 進捗状況をリアルタイムで確認
   - 管理者とメッセージでやり取り

4. **買取承認**
   - 管理者から送信された承認メールを受信
   - 承認URLにアクセス
   - カードごとに承認・拒否・保留を選択
   - 回答を送信

### 管理者側の流れ

1. **ログイン**
   - http://localhost:3000/admin にアクセス
   - Basic認証でログイン

2. **代行案件管理**
   - 新規依頼を確認
   - 案件詳細を閲覧
   - ステータスを更新（受付中→作業中→完了）
   - 顧客にメッセージで連絡

3. **買取承認送信**
   - 「買取承認」タブに移動
   - カード情報を入力
   - 承認申請を送信（顧客にメール送信される）

4. **メッセージ管理**
   - 「メッセージ」タブで顧客とのやり取りを確認
   - 返信を送信

5. **バックアップ**
   - 「バックアップ」タブで手動バックアップ作成
   - 自動バックアップは1時間ごとに実行

## 🔒 セキュリティ

- ✅ HTTP Basic認証（管理者画面）
- ✅ HTTPS/SSL対応
- ✅ セキュリティヘッダー設定
- ✅ XSS対策
- ✅ パスワード保護

## 💾 データ管理

### データ保存

すべてのデータはJSONファイルで保存されます：

- `agency_requests.json` - 代行依頼
- `approval_requests.json` - 買取承認
- `messages.json` - メッセージ

### バックアップ

- **自動バックアップ**: 1時間ごとに自動実行
- **保存期間**: 7日間（古いバックアップは自動削除）
- **保存場所**: `src/data/backups/`
- **手動バックアップ**: 管理ダッシュボードから実行可能

## 🎨 カスタマイズ

### テーマカラー変更

`src/client/user/css/style.css` または `src/client/admin/css/dashboard.css` の `:root` セクションでカラーを変更：

```css
:root {
  --color-primary: #007bff;
  --color-success: #28a745;
  --color-danger: #dc3545;
  /* ... */
}
```

### メールテンプレート

`src/server/integrated_server.js` の各メール送信部分でHTMLテンプレートをカスタマイズ可能

## 🐛 トラブルシューティング

### ポートが使用中の場合

```bash
# ポート使用状況確認
lsof -i :3000
lsof -i :3443

# プロセス終了
kill -9 [PID]
```

### メール送信エラー

- `.env` ファイルのSMTP設定を確認
- `MAIL_DEBUG=true` に変更してデバッグログを確認

### データが表示されない

- ブラウザのキャッシュをクリア
- サーバーを再起動
- JSONファイルの形式が正しいか確認

## 📝 開発メモ

### API エンドポイント

#### 代行依頼API
- `POST /api/agency-request` - 新規代行依頼作成
- `GET /api/agency-request/:requestId` - 依頼詳細取得
- `GET /api/agency-requests` - 依頼一覧取得（管理者のみ）
- `PATCH /api/agency-request/:requestId/status` - ステータス更新（管理者のみ）

#### 買取承認API
- `POST /api/approval-request` - 承認申請送信（管理者のみ）
- `GET /api/approval-requests` - 承認リスト取得（管理者のみ）
- `GET /api/approval/:key` - 承認情報取得
- `POST /api/approval/:key/response` - 承認回答送信

#### メッセージAPI
- `POST /api/messages` - メッセージ送信
- `GET /api/messages/:requestId` - メッセージ取得
- `PATCH /api/messages/:requestId/read` - 既読マーク

#### バックアップAPI
- `POST /api/backup` - バックアップ作成（管理者のみ）
- `GET /api/backups` - バックアップ一覧取得（管理者のみ）

## 📄 ライセンス

ISC

## 👨‍💻 作成者

PSA代行サービス

---

**最終更新**: 2025年10月7日
