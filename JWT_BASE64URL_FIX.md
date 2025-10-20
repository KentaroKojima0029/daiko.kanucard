# 🚨 緊急修正完了：JWTトークンBase64URLデコードエラー解決

## 修正日時
2025年10月20日

## 問題の詳細

### 発生していたエラー
```
InvalidCharacterError: The string contains invalid characters
at atob@native code
```

### 問題の原因
JWTトークンは**Base64URL形式**でエンコードされていますが、フロントエンドで標準の`atob()`関数を使用してデコードしようとしていました。

#### Base64 vs Base64URL の違い

| 項目 | Base64 | Base64URL |
|------|--------|-----------|
| 使用文字（62番目） | `+` | `-` |
| 使用文字（63番目） | `/` | `_` |
| パディング | 必須（`=`） | 省略可能 |
| 用途 | 一般的なエンコーディング | URL/ファイル名に安全 |

JWTはRFC 7519で**Base64URL**の使用が規定されています。

### 影響範囲
- ✅ トークン保存：成功（297文字、3パート構成）
- ✅ トークン読み取り：成功
- ❌ Base64デコード：**失敗**（`atob()`関数エラー）
- ❌ 結果：**ログインループ発生**

## 実施した修正

### 修正ファイル一覧
1. ✅ `login.html` - 認証チェック部分
2. ✅ `home.html` - 認証ガード部分
3. ✅ `index.html` - 認証ゲートウェイ部分

### 追加した関数

#### 1. Base64URLデコード関数
```javascript
// Base64URLデコード関数（JWT用）
// JWTはBase64URL形式（'-', '_'を使用、パディング省略可能）を使用するため、
// 標準のatob()では失敗する。Base64形式に変換してからデコード。
function base64UrlDecode(str) {
    try {
        // Base64URLをBase64に変換
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

        // パディングを追加
        while (base64.length % 4) {
            base64 += '=';
        }

        // デコード
        return atob(base64);
    } catch (e) {
        console.error('[base64UrlDecode] デコードエラー:', e);
        console.error('[base64UrlDecode] 入力文字列:', str);
        throw e;
    }
}
```

**処理の流れ:**
1. `-` を `+` に置換
2. `_` を `/` に置換
3. 不足しているパディング（`=`）を追加
4. 標準の`atob()`でデコード

#### 2. JWTペイロードデコード関数
```javascript
// JWTトークンのペイロードを安全にデコード
function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format: expected 3 parts');
        }

        const payload = base64UrlDecode(parts[1]);
        return JSON.parse(payload);
    } catch (e) {
        console.error('[decodeJwtPayload] JWT解析エラー:', e);
        console.error('[decodeJwtPayload] トークン長:', token.length);
        console.error('[decodeJwtPayload] トークン形式:', {
            parts: token.split('.').length,
            part1Length: token.split('.')[0]?.length,
            part2Length: token.split('.')[1]?.length,
            part3Length: token.split('.')[2]?.length
        });
        throw e;
    }
}
```

**処理の流れ:**
1. JWTを3パートに分割（ヘッダー、ペイロード、署名）
2. パート数の検証（3つでない場合はエラー）
3. ペイロード（2番目のパート）をBase64URLデコード
4. JSON文字列をパースしてオブジェクトに変換

### 修正前のコード（エラーの原因）
```javascript
// ❌ エラーが発生していたコード
const tokenParts = authToken.split('.');
if (tokenParts.length === 3) {
    const payload = JSON.parse(atob(tokenParts[1]));  // ← Base64URLをatob()でデコード失敗
    // ...
}
```

### 修正後のコード
```javascript
// ✅ 修正後のコード
try {
    console.log('[Login] 🔍 トークン検証開始');
    const payload = decodeJwtPayload(authToken);  // ← Base64URLデコード関数を使用
    console.log('[Login] ✅ JWT デコード成功:', {
        email: payload.email,
        exp: payload.exp,
        expiresAt: new Date(payload.exp * 1000).toLocaleString('ja-JP')
    });
    // ...
} catch (e) {
    console.error('[Login] ❌ 無効なトークン - クリア');
    console.error('[Login] エラー:', e);
    // ...
}
```

### デバッグログの強化
各ファイルで以下のデバッグログを追加:

1. **トークン検証開始時**
   ```javascript
   console.log('[Login] 🔍 トークン検証開始');
   ```

2. **デコード成功時**
   ```javascript
   console.log('[Login] ✅ JWT デコード成功:', {
       email: payload.email,
       exp: payload.exp,
       expiresAt: new Date(payload.exp * 1000).toLocaleString('ja-JP')
   });
   ```

3. **エラー発生時**
   ```javascript
   console.error('[Login] エラー名:', e.name);
   console.error('[Login] エラーメッセージ:', e.message);
   console.error('[decodeJwtPayload] トークン形式:', {
       parts: token.split('.').length,
       part1Length: token.split('.')[0]?.length,
       part2Length: token.split('.')[1]?.length,
       part3Length: token.split('.')[2]?.length
   });
   ```

## サーバー側の確認結果

### JWT生成コード（server.js）
```javascript
// ステップ2: OTP検証とトークン発行
const token = jwt.sign(
  {
    customerId: otpData.customerData.id,
    email: otpData.customerData.email,
    firstName: otpData.customerData.firstName,
    lastName: otpData.customerData.lastName
  },
  JWT_SECRET,
  { expiresIn: '30m' }  // 30分のセッション有効期限
);
```

### 検証結果
✅ **サーバー側は正常**

- `jsonwebtoken`ライブラリ（v9.0.2）を使用
- JWT標準（RFC 7519）に準拠
- 自動的にBase64URLエンコーディングを使用
- 修正不要

## 期待される効果

### Before（修正前）
```
ログイン → OTP入力 → 認証成功 → トークン保存
  ↓
ホーム画面へリダイレクト
  ↓
❌ Base64デコードエラー → トークンクリア → ログイン画面へ戻る
  ↓
🔄 ログインループ発生
```

### After（修正後）
```
ログイン → OTP入力 → 認証成功 → トークン保存
  ↓
ホーム画面へリダイレクト
  ↓
✅ Base64URLデコード成功 → ペイロード取得 → 有効期限確認
  ↓
✅ ホーム画面表示（30分間有効）
```

## テスト手順

### 1. ローカル環境でのテスト
```bash
# サーバー起動
cd /Users/ajitama/claude-new-daiko-form
node server.js

# または
npm start
```

### 2. ブラウザテスト
1. **ブラウザのデベロッパーツールを開く（F12）**
2. **Consoleタブを表示**
3. http://localhost:3000/login にアクセス
4. メールアドレスを入力してOTP送信
5. OTPを入力してログイン

### 3. 確認すべきログ
```
[Login] 🚀 ページ初期化
[Login] 現在のURL: http://localhost:3000/login
[Login] 📦 既存トークン確認: {exists: false, length: 0}
[Login] ✅ ログインフォーム表示
========================================
[Login] Sending OTP request for: test@example.com
[Login] Response status: 200
[Login] OTP sent successfully
[Login] OTP検証開始: {email: "test@example.com", otp: "123456"}
[Login] Response status: 200
[Login] ✅ 認証成功 - トークンとユーザーデータを保存します
[Login] 💾 トークン保存確認: {tokenSaved: true, tokenLength: 297, ...}
[Login] ✅ トークン保存完了 - ホーム画面へリダイレクトします
[Login] 🚀 リダイレクト実行: /home
========================================
[Home] 🔐 認証チェック開始
[Home] 現在のURL: http://localhost:3000/home
[Home] 📦 ローカルストレージ確認: {tokenExists: true, tokenLength: 297, ...}
[Home] 🔍 トークン検証開始
[Home] ✅ JWT デコード成功
[Home] 📋 トークン情報: {email: "test@example.com", exp: 1234567890, ...}
[Home] ✅ 認証成功 - ページ読み込み継続
========================================
```

### 4. エラーが発生しないことを確認
❌ **以下のエラーが出ないことを確認:**
```
InvalidCharacterError: The string contains invalid characters
```

✅ **代わりに以下のログが表示される:**
```
[Home] ✅ JWT デコード成功
[Home] ✅ 認証成功 - ページ読み込み継続
```

## 本番環境への適用

### VPSへのデプロイ
```bash
# 1. VPSにSSH接続
ssh user@your-vps

# 2. プロジェクトディレクトリに移動
cd /var/www/psa-api

# 3. バックアップ作成
cp login.html login.html.backup
cp home.html home.html.backup
cp index.html index.html.backup

# 4. 修正ファイルをアップロード（ローカルから）
# ローカルマシンで実行:
scp /Users/ajitama/claude-new-daiko-form/login.html user@your-vps:/var/www/psa-api/
scp /Users/ajitama/claude-new-daiko-form/home.html user@your-vps:/var/www/psa-api/
scp /Users/ajitama/claude-new-daiko-form/index.html user@your-vps:/var/www/psa-api/

# 5. サーバー再起動（不要だが、念のため）
pm2 restart psa-api

# 6. ブラウザキャッシュクリア
# ユーザーにCtrl+Shift+R（強制リロード）を実行してもらう
```

### デプロイ後の確認
```bash
# PM2ログ確認
pm2 logs psa-api --lines 50

# ブラウザで確認
# https://daiko.kanucard.com/login にアクセス
# F12でコンソールを開いてログを確認
```

## トラブルシューティング

### まだログインループが発生する場合

#### 1. ブラウザキャッシュをクリア
```
1. Ctrl + Shift + Delete（Windows/Linux）
   または Command + Shift + Delete（Mac）
2. 「キャッシュされた画像とファイル」を選択
3. 「データを削除」をクリック
```

#### 2. ハードリロード
```
Ctrl + Shift + R（Windows/Linux）
Command + Shift + R（Mac）
```

#### 3. localStorageを手動でクリア
ブラウザコンソールで実行:
```javascript
localStorage.clear();
location.reload();
```

#### 4. デバッグログを確認
ブラウザコンソールで以下を確認:
- `[Login]`, `[Home]`, `[Index]` で始まるログ
- エラーメッセージの詳細
- トークンの長さと形式

#### 5. トークンを手動で検証
ブラウザコンソールで実行:
```javascript
const token = localStorage.getItem('kanucard_auth_token');
console.log('Token:', token);
console.log('Length:', token.length);
console.log('Parts:', token.split('.').length);

// デコードテスト
function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return atob(base64);
}

try {
    const payload = JSON.parse(base64UrlDecode(token.split('.')[1]));
    console.log('Payload:', payload);
    console.log('Expires:', new Date(payload.exp * 1000).toLocaleString());
} catch (e) {
    console.error('Decode error:', e);
}
```

## 技術的な背景

### JWTの構造
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
│                                    │                                                                                      │
│         Header (Base64URL)         │                        Payload (Base64URL)                                         │         Signature (Base64URL)         │
```

### Base64URLエンコーディングが必要な理由
1. **URL安全性**: JWTはURLパラメータとして使用されることがある
2. **ファイル名安全性**: トークンをファイル名に使用できる
3. **標準準拠**: RFC 7519でBase64URLの使用が規定されている

### なぜ`atob()`が失敗したのか
- `atob()`は標準のBase64デコードのみをサポート
- `-`や`_`を含む文字列は「無効な文字」として扱われる
- パディング（`=`）が不足していても失敗する

## まとめ

### 修正内容
✅ Base64URLデコード関数を3つのHTMLファイルに追加
✅ `atob()`の直接使用を`decodeJwtPayload()`に置き換え
✅ 詳細なデバッグログを追加
✅ エラーハンドリングを強化

### 期待される効果
✅ ログインループの完全解消
✅ 認証成功後のスムーズなホーム画面表示
✅ 30分間のセッション維持
✅ 安定したユーザー体験

### 影響なし
✅ サーバー側のコード変更なし
✅ データベース変更なし
✅ API仕様変更なし
✅ 既存機能への影響なし

---

**修正完了日**: 2025年10月20日
**テスト状況**: ローカル環境で動作確認済み
**デプロイ推奨**: 即座に本番環境へ適用可能
