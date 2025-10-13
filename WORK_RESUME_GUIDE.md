# 作業再開ガイド

## プロジェクト情報

**プロジェクトディレクトリ**: `/Users/ajitama/xserver-psa-api`
**リポジトリURL**: https://github.com/KentaroKojima0029/new-daiko-form.git
**作業ブランチ**: `xserver-vps`
**本番URL**: https://daiko.kanucard.com

---

## 🚀 次回作業を始める手順

### 1. ターミナルを開く

```bash
# プロジェクトディレクトリに移動
cd /Users/ajitama/xserver-psa-api
```

### 2. 最新の変更を取得

```bash
# リモートの最新情報を取得
git fetch origin

# 現在のブランチを確認
git branch

# xserver-vpsブランチに切り替え（既に切り替わっている場合はスキップ）
git checkout xserver-vps

# 最新のコードを取得
git pull origin xserver-vps
```

### 3. 現在の状態を確認

```bash
# 変更状況を確認
git status

# 最近のコミットを確認
git log --oneline -10

# 未コミットの変更があれば確認
git diff
```

---

## 📝 最新の実装内容（2025-10-13）

### ✅ 本日完了した変更

#### 1. **次回発送スケジュールのグラデーション表示機能**

締切時間が近づくにつれて、カウントダウン表示の色が段階的に変化します。

**グラデーション仕様:**
- **100% - 80% (時間に余裕あり)**: 青 (#3b82f6)
- **80% - 60% (まだ余裕あり)**: 緑 (#10b981)
- **60% - 40% (やや注意)**: 黄色 (#f59e0b)
- **40% - 20% (締切接近)**: オレンジ (#f97316)
- **20% - 0% (締切間近)**: 赤 (#ef4444)

**実装箇所:**
- `index.html` Lines 953-992: `getGradientColor()` 関数追加
- `index.html` Lines 1056-1067: アメリカ発送カウントダウンにグラデーション適用
- `index.html` Lines 1089-1099: 日本発送カウントダウンにグラデーション適用

#### 2. **早期申込割引機能の実装**

受付開始から3日間限定で0.5%の割引を適用します。

**割引仕様:**
- 適用期間: 受付開始から3日間（0日目、1日目、2日目）
- 割引率: 全プラン共通で0.5%
- 表示箇所:
  - `index.html`: 割引バッジに具体的な割引内容を表示
  - `form.html`: 確認画面に「🎉 早期申込割引（0.5%）」として割引額を表示

**実装箇所:**
- `form.html` Lines 1774-1803: `isWithinDiscountPeriod()` 関数追加
- `form.html` Lines 1805-1827: `getFeePercentage()` に割引適用ロジック追加
- `form.html` Lines 1829-1842: `calculateDiscount()` 関数追加
- `form.html` Lines 1937-1951: 確認画面での割引表示ロジック追加
- `index.html` Lines 1137-1163: 割引バッジ表示ロジック更新

#### 3. **スケジュール表示の改善**

- 「受付開始」を非表示（内部動作のみ）
- 「貨物到着予定」→「※弊社必着」に変更
- 割引バッジを受付開始から3日間のみ表示

### ✅ 以前完了した変更

1. **代行料率を2.5%引き上げ**
   - ノーマル 日本: 2.2% → **4.7%**
   - 70％保証 日本: 3.3% → **5.8%**
   - ノーマル アメリカ: 3.3% → **5.8%**
   - 70％保証 アメリカ: 5.0% → **7.5%**

2. **最低代行料300円/枚を実装**
   - `calculateAgencyFee()` 関数を追加
   - カード一覧、合計計算、確認画面、メール送信すべてに適用

3. **通関手数料1000円を追加**
   - 最終確認画面の2回目のお支払いに表示
   - 合計金額に反映
   - メール送信データに含める

---

## 📂 主要ファイル

### フロントエンド
- **index.html** - トップページ・発送スケジュール・グラデーション表示
- **form.html** - 代行依頼フォーム・割引計算・確認画面

### バックエンド
- **server.js** - Node.jsサーバー
- **email-service.js** - メール送信サービス

### ドキュメント
- **CLAUDE.md** - プロジェクト全体の説明とセットアップガイド
- **WORK_RESUME_GUIDE.md** - この作業再開ガイド（最新の実装内容）
- **VPS_UPDATE_GUIDE.md** - VPSデプロイ手順
- **RENDER_ENV_SETUP.md** - Render環境変数設定

---

## 🔧 開発環境

### ローカルサーバー起動（テスト用）

```bash
# Node.jsサーバーを起動
node server.js

# ブラウザで開く
# http://localhost:3000
```

### 動作確認方法

#### グラデーション表示の確認
1. ホームページ `http://localhost:3000/` にアクセス
2. 「次回発送スケジュール」セクションを確認
3. カウントダウンタイマーの色が残り時間に応じて変化することを確認

#### 割引機能の確認
1. 受付開始日から3日以内であることを確認（必要に応じてシステム日時を調整）
2. ホームページで割引バッジ「受付開始から3日間限定！全プラン0.5%割引」が表示されることを確認
3. 代行フォームで申込を進め、確認画面で「🎉 早期申込割引（0.5%）」が表示されることを確認

### コード編集

```bash
# VSCodeで開く
code .

# または他のエディタで開く
open -a "Visual Studio Code" .
```

---

## 📤 変更をデプロイする手順

### ステップ1: ローカルで変更をコミット

```bash
# 変更ファイルを確認
git status

# ファイルをステージング
git add form.html index.html server.js  # 変更したファイルを指定

# コミット
git commit -m "変更内容の説明

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
"
```

### ステップ2: リモートにプッシュ

```bash
# xserver-vpsブランチにプッシュ
git push origin xserver-vps
```

### ステップ3: VPSサーバーにデプロイ

VPSに手動でSSH接続してデプロイ:

```bash
# VPSに接続
ssh root@x162-43-92-176.static.ctinets.com

# プロジェクトディレクトリに移動
cd /var/www/psa-api

# 最新のコードを取得
git pull origin xserver-vps

# サーバー再起動
pm2 restart psa-api

# ログ確認
pm2 logs psa-api --lines 50

# 接続を終了
exit
```

---

## 🐛 トラブルシューティング

### グラデーション色が変化しない場合

1. ブラウザのキャッシュをクリア（Cmd+Shift+R / Ctrl+Shift+F5）
2. JavaScriptコンソールでエラーがないか確認
3. `updateCountdowns()` 関数が正しく実行されているか確認
4. ブラウザの開発者ツールで要素のスタイルを確認

### 割引が適用されない場合

1. 現在の日時が受付開始日から3日以内か確認
2. ブラウザのJavaScriptコンソールで `isWithinDiscountPeriod(plan)` の戻り値を確認
3. form.htmlが最新版か確認
4. ブラウザのキャッシュをクリア

### コンフリクトが発生した場合

```bash
# リモートの変更を確認
git fetch origin

# リモートとの差分を確認
git diff origin/xserver-vps

# マージ
git merge origin/xserver-vps

# コンフリクトがある場合は手動で解決後
git add .
git commit -m "Resolve merge conflicts"
```

### ローカルの変更を一時退避

```bash
# 変更を一時保存
git stash

# 最新のコードを取得
git pull origin xserver-vps

# 変更を戻す
git stash pop
```

### ローカルの変更を完全に破棄

```bash
# ⚠️ 注意: この操作は元に戻せません
git reset --hard origin/xserver-vps
```

---

## 🔍 技術仕様

### 使用技術
- **フロントエンド**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **バックエンド**: Node.js, Express.js
- **メール送信**: Nodemailer
- **デプロイ**: VPS (Xserver), PM2

### ブラウザ対応
- Chrome (最新版)
- Firefox (最新版)
- Safari (最新版)
- Edge (最新版)
- モバイルブラウザ (iOS Safari, Chrome for Android)

### レスポンシブ対応
- デスクトップ (1200px以上)
- タブレット (768px - 1199px)
- モバイル (767px以下)

---

## 📋 主要関数の説明

### index.html

#### `getGradientColor(percentage)`
残り時間の割合（0-100%）に応じてグラデーション色を返す関数。

**パラメータ:**
- `percentage`: 残り時間の割合 (100が最も時間がある状態、0が締切)

**戻り値:**
```javascript
{
    text: '#3b82f6',      // テキスト色
    gradient: 'linear-gradient(135deg, #3b82f6, #1e40af)',  // グラデーション
    border: 'linear-gradient(135deg, #3b82f6, #1e40af)'     // ボーダーグラデーション
}
```

#### `updateCountdowns()`
カウントダウン表示を更新する関数。1分ごとに実行されます。

### form.html

#### `isWithinDiscountPeriod(plan)`
現在が受付開始から3日以内かを判定する関数。

**パラメータ:**
- `plan`: プラン名 ('normal', 'guarantee', 'normal_usa', 'guarantee_usa')

**戻り値:**
- `true`: 割引期間内
- `false`: 割引期間外

#### `calculateDiscount(plan, serviceOption)`
割引額を計算する関数。

**パラメータ:**
- `plan`: プラン名
- `serviceOption`: サービスオプション

**戻り値:**
- 割引額（円）

#### `getFeePercentage(plan, serviceOption)`
手数料率を取得する関数（割引適用後）。

**パラメータ:**
- `plan`: プラン名
- `serviceOption`: サービスオプション

**戻り値:**
- 手数料率（小数）

---

## 📞 連絡先・リソース

- **GitHubリポジトリ**: https://github.com/KentaroKojima0029/new-daiko-form
- **本番サイト**: https://daiko.kanucard.com
- **Renderダッシュボード**: https://dashboard.render.com

---

## 📝 次回作業時のチェックリスト

- [ ] プロジェクトディレクトリに移動: `cd /Users/ajitama/xserver-psa-api`
- [ ] 最新のコードを取得: `git pull origin xserver-vps`
- [ ] 変更前にブランチを確認: `git branch`
- [ ] ローカルサーバーで動作確認: `node server.js`
- [ ] 変更後はコミット: `git add . && git commit -m "変更内容"`
- [ ] リモートにプッシュ: `git push origin xserver-vps`
- [ ] VPSにデプロイ（必要に応じて）

---

## 🎯 次回の作業予定（未実装機能）

### 優先度: 高
- [ ] サーバー側での割引計算の実装（セキュリティ対策）
- [ ] 割引適用のログ記録
- [ ] グラデーション色のアニメーション効果追加

### 優先度: 中
- [ ] 割引キャンペーンの管理画面追加
- [ ] 割引率の動的変更機能
- [ ] カウントダウンの音声通知機能

### 優先度: 低
- [ ] グラデーション色のカスタマイズ機能
- [ ] 複数の割引キャンペーンの同時実施機能

---

**最終更新**: 2025-10-13
**作成者**: Claude Code
**バージョン**: 2.0
