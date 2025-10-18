# Render環境変数設定ガイド

## 必須環境変数チェックリスト

Renderのダッシュボード（Environment Variables）で以下の環境変数を設定してください。

### 1. サーバー設定

```env
NODE_ENV=production
PORT=3000
```

### 2. SMTP設定（Xserver）

```env
SMTP_HOST=sv10210.xserver.jp
SMTP_PORT=587
SMTP_USER=collection@kanucard.com
SMTP_PASS=Kanu29012300
FROM_EMAIL=collection@kanucard.com
ADMIN_EMAIL=collection@kanucard.com
MAIL_DEBUG=false
```

### 3. Shopify設定

```env
SHOPIFY_SHOP_NAME=kanucard
SHOPIFY_ADMIN_ACCESS_TOKEN=（実際のトークンを設定）
```

### 4. **メール送信フォールバック設定（重要）**

```env
USE_XSERVER_FALLBACK=true
XSERVER_API_URL=https://api.kanucard.com
XSERVER_API_KEY=（VPS側と同じAPIキーを設定）
```

⚠️ **注意**: この設定がないとフォールバック機能が動作しません！

### 5. 管理画面設定

```env
ADMIN_ORIGIN=https://kanucard.com
ADMIN_API_URL=https://kanucard-daiko-support.onrender.com
```

## 設定手順

### ステップ1: Renderダッシュボードにアクセス

1. https://dashboard.render.com にログイン
2. 対象のWebサービスを選択
3. 左メニューから「Environment」をクリック

### ステップ2: 環境変数を追加

各環境変数を以下の形式で追加：

| Key | Value |
|-----|-------|
| `USE_XSERVER_FALLBACK` | `true` |
| `XSERVER_API_URL` | `https://api.kanucard.com` |
| `XSERVER_API_KEY` | `（APIキーをペースト）` |

### ステップ3: デプロイ

「Save Changes」をクリックすると、Renderが自動的に再デプロイを開始します。

### ステップ4: 動作確認

デプロイ完了後、ログを確認：

```
[email-service] Email service ready
[email-service] Fallback enabled: true
[email-service] API configured: true
```

## トラブルシューティング

### フォールバックが動作しない

**症状**: `Connection timeout` エラーでメール送信失敗

**原因**: 環境変数が設定されていない

**解決方法**:
1. Render Dashboard > Environment で以下を確認：
   - `USE_XSERVER_FALLBACK` = `true`
   - `XSERVER_API_URL` = `https://api.kanucard.com`
   - `XSERVER_API_KEY` = （設定されているか）
2. 設定後、必ず「Save Changes」をクリック
3. 再デプロイを待つ
4. ログで設定を確認

### ログで設定を確認する方法

Renderのログで以下のメッセージを確認：

```
✅ 正しい設定:
[INFO] Email service ready {
  fallbackEnabled: true,
  apiConfigured: true
}

❌ 設定不足:
[WARN] Email configuration issues {
  issues: ['XSERVER_API_URL not set', 'XSERVER_API_KEY not set']
}
```

### APIキーが不明な場合

VPS側で確認：

```bash
# VPS上で実行
grep XSERVER_API_KEY /var/www/psa-api/.env
```

または新しく生成：

```bash
# 新しいAPIキーを生成
openssl rand -hex 32

# VPS側の.envを更新
nano /var/www/psa-api/.env
# XSERVER_API_KEY=新しいキー

# VPSサーバー再起動
pm2 restart psa-api

# Render側も同じキーに更新
```

## 確認用cURLコマンド

環境変数が正しく設定されているか確認：

```bash
# Renderアプリケーションにリクエスト
curl https://daiko.kanucard.com/api/health

# 期待されるレスポンス（emailConfigセクションを確認）
{
  "status": "healthy",
  "emailConfig": {
    "fallbackEnabled": true,
    "apiConfigured": true
  }
}
```

## 完全な環境変数リスト（コピー用）

```
NODE_ENV=production
PORT=3000
SMTP_HOST=sv10210.xserver.jp
SMTP_PORT=587
SMTP_USER=collection@kanucard.com
SMTP_PASS=Kanu29012300
FROM_EMAIL=collection@kanucard.com
ADMIN_EMAIL=collection@kanucard.com
MAIL_DEBUG=false
SHOPIFY_SHOP_NAME=kanucard
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
USE_XSERVER_FALLBACK=true
XSERVER_API_URL=https://api.kanucard.com
XSERVER_API_KEY=your-api-key-here
ADMIN_ORIGIN=https://kanucard.com
ADMIN_API_URL=https://kanucard-daiko-support.onrender.com
```

⚠️ **重要**: `SHOPIFY_ADMIN_ACCESS_TOKEN` と `XSERVER_API_KEY` は実際の値に置き換えてください。

---

**関連ドキュメント**:
- [MAIL_FALLBACK_SETUP.md](./MAIL_FALLBACK_SETUP.md) - フォールバック機能詳細
- [README_VPS.md](./README_VPS.md) - VPS側の設定
