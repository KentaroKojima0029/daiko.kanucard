const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// データ保存用
const dataFilePath = path.join(__dirname, '../data/approval_requests.json');
let approvalRequests = {};

// データの読み込み
function loadData() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      approvalRequests = JSON.parse(data);
      console.log('データを読み込みました');
    }
  } catch (error) {
    console.error('データ読み込みエラー:', error);
    approvalRequests = {};
  }
}

// データの保存
function saveData() {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(approvalRequests, null, 2));
  } catch (error) {
    console.error('データ保存エラー:', error);
  }
}

// 起動時にデータを読み込む
loadData();

// ミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// セキュリティヘッダー
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Basic認証ミドルウェア
function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('認証が必要です');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || '#collection30';

  if (username === adminUser && password === adminPass) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    res.status(401).send('認証に失敗しました');
  }
}

// メール送信設定
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  debug: process.env.MAIL_DEBUG === 'true',
  logger: process.env.MAIL_DEBUG === 'true'
});

// 管理者ページ
app.get('/admin', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin/html/index.html'));
});

app.get('/admin/css/admin.css', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin/css/admin.css'));
});

app.get('/admin/js/admin.js', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin/js/admin.js'));
});

// 承認申請API
app.post('/api/approval-request', basicAuth, async (req, res) => {
  try {
    const { customerName, email, cards } = req.body;

    if (!customerName || !email || !cards || cards.length === 0) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    const approvalKey = uuidv4();
    const approvalUrl = `${req.protocol}://${req.get('host')}/approval/${approvalKey}`;

    approvalRequests[approvalKey] = {
      customerName,
      email,
      cards,
      createdAt: new Date().toISOString(),
      status: 'pending',
      responses: {}
    };

    saveData();

    // カード情報のHTML生成
    const cardsHtml = cards.map((card, index) => `
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd;">${index + 1}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${card.playerName}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${card.year}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${card.cardName}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${card.number}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${card.gradeLevel}</td>
      </tr>
    `).join('');

    // メール送信
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: 'PSA代行買取の承認依頼',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">PSA代行買取の承認依頼</h2>
          <p>${customerName} 様</p>
          <p>以下のカードについて、PSA代行買取の承認をお願いいたします。</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 12px; border: 1px solid #ddd;">No.</th>
                <th style="padding: 12px; border: 1px solid #ddd;">選手名</th>
                <th style="padding: 12px; border: 1px solid #ddd;">年</th>
                <th style="padding: 12px; border: 1px solid #ddd;">カード名</th>
                <th style="padding: 12px; border: 1px solid #ddd;">番号</th>
                <th style="padding: 12px; border: 1px solid #ddd;">グレードレベル</th>
              </tr>
            </thead>
            <tbody>
              ${cardsHtml}
            </tbody>
          </table>

          <p style="margin: 30px 0;">
            <a href="${approvalUrl}"
               style="display: inline-block; padding: 12px 24px; background-color: #007bff;
                      color: white; text-decoration: none; border-radius: 4px;">
              承認ページへ
            </a>
          </p>

          <p style="color: #666; font-size: 14px;">
            このリンクは一度のみ有効です。<br>
            ご不明な点がございましたら、お気軽にお問い合わせください。
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: '承認申請を送信しました',
      approvalKey
    });

  } catch (error) {
    console.error('承認申請エラー:', error);
    res.status(500).json({ error: 'メール送信に失敗しました' });
  }
});

// 承認リスト取得API
app.get('/api/approval-requests', basicAuth, (req, res) => {
  const requests = Object.entries(approvalRequests).map(([key, value]) => ({
    approvalKey: key,
    ...value
  }));
  res.json(requests);
});

// 顧客承認ページ
app.get('/approval/:key', (req, res) => {
  const { key } = req.params;

  if (!approvalRequests[key]) {
    return res.status(404).send('承認キーが無効です');
  }

  if (approvalRequests[key].status !== 'pending') {
    return res.send('この承認は既に完了しています');
  }

  res.sendFile(path.join(__dirname, '../client/customer/html/index.html'));
});

app.get('/approval/:key/css/customer.css', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/customer/css/customer.css'));
});

app.get('/approval/:key/js/customer.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/customer/js/customer.js'));
});

// 承認情報取得API
app.get('/api/approval/:key', (req, res) => {
  const { key } = req.params;

  if (!approvalRequests[key]) {
    return res.status(404).json({ error: '承認キーが無効です' });
  }

  res.json(approvalRequests[key]);
});

// 承認回答API
app.post('/api/approval/:key/response', async (req, res) => {
  try {
    const { key } = req.params;
    const { responses } = req.body;

    if (!approvalRequests[key]) {
      return res.status(404).json({ error: '承認キーが無効です' });
    }

    if (approvalRequests[key].status !== 'pending') {
      return res.status(400).json({ error: 'この承認は既に完了しています' });
    }

    approvalRequests[key].responses = responses;
    approvalRequests[key].status = 'completed';
    approvalRequests[key].completedAt = new Date().toISOString();

    saveData();

    // 管理者への通知メール
    const resultsHtml = approvalRequests[key].cards.map((card, index) => {
      const response = responses[index] || 'unknown';
      const statusText = {
        approved: '承認',
        rejected: '拒否',
        pending: '保留'
      }[response] || '不明';

      const statusColor = {
        approved: '#28a745',
        rejected: '#dc3545',
        pending: '#ffc107'
      }[response] || '#6c757d';

      return `
        <tr>
          <td style="padding: 12px; border: 1px solid #ddd;">${index + 1}</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${card.playerName}</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${card.year}</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${card.cardName}</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${card.number}</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${card.gradeLevel}</td>
          <td style="padding: 12px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">
            ${statusText}
          </td>
        </tr>
      `;
    }).join('');

    const adminMailOptions = {
      from: process.env.FROM_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `承認回答を受信しました - ${approvalRequests[key].customerName}様`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h2 style="color: #333;">承認回答を受信しました</h2>
          <p><strong>顧客名:</strong> ${approvalRequests[key].customerName}</p>
          <p><strong>メールアドレス:</strong> ${approvalRequests[key].email}</p>

          <h3 style="color: #333; margin-top: 30px;">回答結果</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 12px; border: 1px solid #ddd;">No.</th>
                <th style="padding: 12px; border: 1px solid #ddd;">選手名</th>
                <th style="padding: 12px; border: 1px solid #ddd;">年</th>
                <th style="padding: 12px; border: 1px solid #ddd;">カード名</th>
                <th style="padding: 12px; border: 1px solid #ddd;">番号</th>
                <th style="padding: 12px; border: 1px solid #ddd;">グレードレベル</th>
                <th style="padding: 12px; border: 1px solid #ddd;">回答</th>
              </tr>
            </thead>
            <tbody>
              ${resultsHtml}
            </tbody>
          </table>
        </div>
      `
    };

    await transporter.sendMail(adminMailOptions);

    res.json({ success: true, message: '回答を送信しました' });

  } catch (error) {
    console.error('承認回答エラー:', error);
    res.status(500).json({ error: '回答の処理に失敗しました' });
  }
});

// ルートリダイレクト
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// 404ハンドラー
app.use((req, res) => {
  res.status(404).send('ページが見つかりません');
});

// SSL証明書の読み込み
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, '../config/server.key')),
  cert: fs.readFileSync(path.join(__dirname, '../config/server.crt'))
};

// HTTPサーバー起動
http.createServer(app).listen(HTTP_PORT, () => {
  console.log(`HTTPサーバーが起動しました: http://localhost:${HTTP_PORT}`);
});

// HTTPSサーバー起動
https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`HTTPSサーバーが起動しました: https://localhost:${HTTPS_PORT}`);
  console.log(`管理者ダッシュボード: https://localhost:${HTTP_PORT}/admin`);
});
