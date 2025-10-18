# メール送信フォールバック機能 - 設定ガイド

## 概要

このシステムは、RenderなどのクラウドプラットフォームでSMTP接続が制限される問題を解決するため、XserverVPS APIを使用したメール送信フォールバック機能を実装しています。

## 動作フロー

```
┌─────────────────────────────────────────────────────┐
│ Render環境（メール送信リクエスト）                    │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ 1次試行: SMTP  │
         │ (15秒タイムアウト)│
         └────────┬───────┘
                  │
         ┌────────┴────────┐
         │                 │
    成功 │                 │ 失敗/タイムアウト
         │                 │
         ▼                 ▼
    ┌────────┐    ┌────────────────────┐
    │ 送信完了 │    │ フォールバック試行  │
    └────────┘    │ XserverVPS API    │
                  └────────┬───────────┘
                           │
                  ┌────────┴────────┐
                  │                 │
             成功 │                 │ 失敗
                  │                 │
                  ▼                 ▼
             ┌────────┐      ┌──────────┐
             │ 送信完了 │      │ エラー返却 │
             └────────┘      └──────────┘
```

## アーキテクチャ

### ファイル構成

```
xserver-psa-api/
├── email-service.js          # メール送信サービス（フォールバック機能）
├── email-api-endpoint.js     # VPS側のメール送信APIエンドポイント
├── server.js                 # メインサーバー（APIルート定義）
└── .env.production           # 環境変数設定
```

### コンポーネント説明

1. **email-service.js**
   - メール送信の主要ロジック
   - SMTP送信の試行
   - フォールバックAPIの呼び出し
   - エラーハンドリング

2. **email-api-endpoint.js**
   - VPS上で動作するAPIエンドポイント
   - APIキー認証
   - Xserver SMTPを使用したメール送信

3. **server.js**
   - `/api/send-email` エンドポイントの提供
   - 既存のメール送信処理を`sendEmail()`に置き換え

## セットアップ手順

### 1. VPS側の設定

#### ステップ1: APIキーの生成

```bash
# セキュアなランダムキーを生成
openssl rand -hex 32
```

出力例:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

#### ステップ2: 環境変数の設定

VPS上の`.env`ファイルに以下を追加：

```env
# メール送信API認証キー
XSERVER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

#### ステップ3: サーバーの再起動

```bash
pm2 restart psa-api
```

#### ステップ4: API動作確認

```bash
curl -X POST http://localhost:3000/api/send-email \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2" \
  -d '{
    "to": "test@example.com",
    "subject": "テストメール",
    "html": "<h1>動作確認</h1><p>VPS APIからのメール送信テスト</p>",
    "text": "動作確認 - VPS APIからのメール送信テスト"
  }'
```

期待されるレスポンス:
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "<random-message-id@kanucard.com>"
}
```

### 2. Render側の設定

#### ステップ1: 環境変数の設定

Render Dashboard > Environment Variables に以下を追加：

| 変数名 | 値 |
|--------|-----|
| `USE_XSERVER_FALLBACK` | `true` |
| `XSERVER_API_URL` | `https://api.kanucard.com` |
| `XSERVER_API_KEY` | `a1b2c3d4...（VPSと同じキー）` |

#### ステップ2: デプロイ

環境変数を設定後、Renderが自動的に再デプロイします。

#### ステップ3: 動作確認

Renderアプリケーションのログを確認：

```
[email-service] Attempting to send via direct SMTP
[email-service] SMTP send error: ETIMEDOUT
[email-service] Attempting to send via XserverVPS API
[email-service] Email sent successfully via XserverVPS API
```

## API仕様

### エンドポイント

```
POST /api/send-email
```

### リクエストヘッダー

| ヘッダー | 必須 | 説明 |
|---------|------|------|
| `Content-Type` | Yes | `application/json` |
| `X-Api-Key` | Yes | API認証キー |

### リクエストボディ

```json
{
  "from": "sender@example.com",      // オプション（デフォルト: FROM_EMAIL）
  "to": "recipient@example.com",     // 必須
  "replyTo": "reply@example.com",    // オプション
  "subject": "メール件名",            // 必須
  "html": "<h1>HTMLコンテンツ</h1>", // htmlまたはtextが必須
  "text": "テキストコンテンツ"        // htmlまたはtextが必須
}
```

### レスポンス

**成功時 (200 OK):**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "<message-id@kanucard.com>"
}
```

**エラー時 (4xx/5xx):**
```json
{
  "success": false,
  "error": "エラーメッセージ",
  "details": "詳細情報（開発環境のみ）"
}
```

## セキュリティ

### 認証

APIキーはHTTPヘッダー `X-Api-Key` で送信されます。キーが一致しない場合、以下のエラーを返します：

- **401 Unauthorized**: APIキーが送信されていない
- **403 Forbidden**: APIキーが無効

### ベストプラクティス

1. **強力なAPIキー**
   - 最低32バイト（64文字）のランダムな16進数文字列を使用
   - 定期的にローテーション（3〜6ヶ月ごと）

2. **HTTPS通信**
   - 本番環境では必ずHTTPSを使用
   - Nginxで証明書を適切に設定

3. **レート制限**
   - 必要に応じてNginxでレート制限を設定
   - 例: 1IPあたり10リクエスト/分

4. **ログ管理**
   - APIキーをログに記録しない
   - 送信先メールアドレスのみをログに記録

## トラブルシューティング

### エラー: "API key required"

**原因**: APIキーヘッダーが送信されていない

**解決方法**:
```bash
# ヘッダーを確認
curl -v -X POST ... -H "X-Api-Key: your-key"
```

### エラー: "Invalid API key"

**原因**: APIキーが一致しない

**解決方法**:
1. VPS側の`.env`を確認
2. Render側の環境変数を確認
3. キーが完全に一致しているか確認（スペース等）

### エラー: "Failed to send email"

**原因**: SMTP設定が不正

**解決方法**:
```bash
# VPS上でSMTP設定を確認
cat .env | grep SMTP

# 手動でSMTP接続をテスト
telnet sv10210.xserver.jp 587
```

### フォールバックが動作しない

**原因**: 環境変数が設定されていない

**解決方法**:
```bash
# Render側の環境変数を確認
USE_XSERVER_FALLBACK=true
XSERVER_API_URL=https://api.kanucard.com
XSERVER_API_KEY=（設定されているか確認）

# ログを確認
[email-service] Fallback enabled: true
[email-service] API configured: true
```

## パフォーマンス

### タイムアウト設定

| 段階 | タイムアウト |
|------|-------------|
| SMTP接続 | 15秒 |
| SMTPグリーティング | 10秒 |
| SMTPソケット | 15秒 |
| VPS API呼び出し | 30秒 |

### 想定処理時間

| ケース | 処理時間 |
|--------|----------|
| SMTP成功 | 1〜5秒 |
| SMTP失敗→API成功 | 16〜20秒 |
| 両方失敗 | 45〜50秒 |

## モニタリング

### ログの確認

```bash
# Render側
# Dashboard > Logs で確認

# VPS側
pm2 logs psa-api | grep email-service
```

### メトリクス

重要な指標：
- SMTP成功率
- フォールバック使用率
- 平均送信時間
- エラー率

## まとめ

この機能により、Render環境でのSMTP制限を完全に回避し、安定したメール送信を実現できます。

VPS側とRender側の両方で適切に設定することで：
- SMTP接続が可能な場合は高速送信
- SMTP失敗時は自動的にVPS APIにフォールバック
- 100%に近いメール送信成功率を達成

---

**関連ドキュメント**:
- [README_VPS.md](./README_VPS.md) - VPSデプロイメントガイド
- [ENV_SETUP.md](./ENV_SETUP.md) - 環境変数設定詳細
