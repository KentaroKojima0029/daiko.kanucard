const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 静的ファイルの配信設定
app.use(express.static(__dirname));
app.use('/src', express.static(path.join(__dirname, 'src')));

// ルートパスへのアクセス
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 利用者向けページ（代行依頼フォーム）
app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/client/user/html/index.html'));
});

// マイページ
app.get('/mypage', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/client/user/html/mypage.html'));
});

// 管理者ダッシュボード
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/client/admin/html/dashboard.html'));
});

// 顧客承認ページ
app.get('/approval', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/client/customer/html/index.html'));
});

// CSS配信
app.get('/user/css/:file', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/client/user/css', req.params.file));
});

app.get('/admin/css/:file', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/client/admin/css', req.params.file));
});

app.get('/approval/css/:file', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/client/customer/css', req.params.file));
});

// JavaScript配信
app.get('/user/js/:file', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/client/user/js', req.params.file));
});

app.get('/admin/js/:file', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/client/admin/js', req.params.file));
});

app.get('/approval/js/:file', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/client/customer/js', req.params.file));
});

// 404ハンドラー
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - ページが見つかりません</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 60px 40px;
          border-radius: 20px;
          text-align: center;
          max-width: 500px;
        }
        h1 { color: #333; margin-bottom: 20px; }
        p { color: #666; margin-bottom: 30px; }
        a {
          display: inline-block;
          padding: 12px 30px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 8px;
        }
        a:hover { background: #5568d3; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404 - ページが見つかりません</h1>
        <p>お探しのページは存在しません。</p>
        <a href="/">トップページへ戻る</a>
      </div>
    </body>
    </html>
  `);
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`
==================================================
🚀 PSA代行サービス - 静的配信サーバー起動
==================================================
📍 サーバー: http://localhost:${PORT}
📍 利用者ページ: http://localhost:${PORT}/user
📍 管理者ダッシュボード: http://localhost:${PORT}/admin
📍 顧客承認ページ: http://localhost:${PORT}/approval
==================================================
`);
});
