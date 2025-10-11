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

// データファイルパス
const agencyRequestsPath = path.join(__dirname, '../data/agency_requests.json');
const approvalRequestsPath = path.join(__dirname, '../data/approval_requests.json');
const messagesPath = path.join(__dirname, '../data/messages.json');
const backupDir = path.join(__dirname, '../data/backups');

// データオブジェクト
let agencyRequests = {};
let approvalRequests = {};
let messages = {};

// バックアップディレクトリ作成
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// データ読み込み
function loadData() {
  try {
    if (fs.existsSync(agencyRequestsPath)) {
      agencyRequests = JSON.parse(fs.readFileSync(agencyRequestsPath, 'utf8'));
    }
    if (fs.existsSync(approvalRequestsPath)) {
      approvalRequests = JSON.parse(fs.readFileSync(approvalRequestsPath, 'utf8'));
    }
    if (fs.existsSync(messagesPath)) {
      messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    }
    console.log('✓ データを読み込みました');
  } catch (error) {
    console.error('データ読み込みエラー:', error);
    agencyRequests = {};
    approvalRequests = {};
    messages = {};
  }
}

// データ保存
function saveData() {
  try {
    fs.writeFileSync(agencyRequestsPath, JSON.stringify(agencyRequests, null, 2));
    fs.writeFileSync(approvalRequestsPath, JSON.stringify(approvalRequests, null, 2));
    fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error('データ保存エラー:', error);
  }
}

// 自動バックアップ
function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupPath = path.join(backupDir, `backup_${timestamp}`);

    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    if (fs.existsSync(agencyRequestsPath)) {
      fs.copyFileSync(agencyRequestsPath, path.join(backupPath, 'agency_requests.json'));
    }
    if (fs.existsSync(approvalRequestsPath)) {
      fs.copyFileSync(approvalRequestsPath, path.join(backupPath, 'approval_requests.json'));
    }
    if (fs.existsSync(messagesPath)) {
      fs.copyFileSync(messagesPath, path.join(backupPath, 'messages.json'));
    }

    console.log(`✓ バックアップ作成: ${timestamp}`);

    // 古いバックアップを削除（7日以上前）
    const backups = fs.readdirSync(backupDir);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    backups.forEach(backup => {
      const backupFullPath = path.join(backupDir, backup);
      const stats = fs.statSync(backupFullPath);
      if (stats.mtimeMs < sevenDaysAgo) {
        fs.rmSync(backupFullPath, { recursive: true, force: true });
        console.log(`✓ 古いバックアップを削除: ${backup}`);
      }
    });
  } catch (error) {
    console.error('バックアップエラー:', error);
  }
}

// 起動時にデータ読み込み
loadData();

// 定期バックアップ（1時間ごと）
setInterval(createBackup, 60 * 60 * 1000);

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

// ============================================
// 利用者向けルート
// ============================================

// 利用者ホームページ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/user/html/index.html'));
});

app.get('/user/css/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/user/css', req.params.file));
});

app.get('/user/js/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/user/js', req.params.file));
});

// 利用者マイページ
app.get('/mypage/:requestId', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/user/html/mypage.html'));
});

// ============================================
// 代行依頼API
// ============================================

// 代行依頼作成
app.post('/api/agency-request', async (req, res) => {
  try {
    const { customerName, email, phone, cards, budget, requirements } = req.body;

    if (!customerName || !email || !cards || cards.length === 0) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    const requestId = uuidv4();
    const myPageUrl = `${req.protocol}://${req.get('host')}/mypage/${requestId}`;

    agencyRequests[requestId] = {
      requestId,
      customerName,
      email,
      phone: phone || '',
      cards,
      budget: budget || '',
      requirements: requirements || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: [{
        timestamp: new Date().toISOString(),
        status: 'pending',
        note: '代行依頼を受け付けました'
      }]
    };

    saveData();

    // 顧客へのメール
    const cardsHtml = cards.map((card, index) => `
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd;">${index + 1}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${card.playerName}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${card.year || '-'}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${card.cardName}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${card.number || '-'}</td>
      </tr>
    `).join('');

    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: 'PSA代行依頼を受け付けました',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">PSA代行依頼受付完了</h2>
          <p>${customerName} 様</p>
          <p>以下の内容で代行依頼を受け付けました。</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 12px; border: 1px solid #ddd;">No.</th>
                <th style="padding: 12px; border: 1px solid #ddd;">選手名</th>
                <th style="padding: 12px; border: 1px solid #ddd;">年</th>
                <th style="padding: 12px; border: 1px solid #ddd;">カード名</th>
                <th style="padding: 12px; border: 1px solid #ddd;">番号</th>
              </tr>
            </thead>
            <tbody>
              ${cardsHtml}
            </tbody>
          </table>

          ${budget ? `<p><strong>予算:</strong> ${budget}</p>` : ''}
          ${requirements ? `<p><strong>希望条件:</strong> ${requirements}</p>` : ''}

          <p style="margin: 30px 0;">
            <a href="${myPageUrl}"
               style="display: inline-block; padding: 12px 24px; background-color: #007bff;
                      color: white; text-decoration: none; border-radius: 4px;">
              マイページで進捗確認
            </a>
          </p>

          <p style="color: #666; font-size: 14px;">
            マイページでは進捗状況の確認やメッセージのやり取りができます。<br>
            ブックマークしてご利用ください。
          </p>
        </div>
      `
    });

    // 管理者へのメール
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `新規代行依頼 - ${customerName}様`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">新規代行依頼</h2>
          <p><strong>顧客名:</strong> ${customerName}</p>
          <p><strong>メール:</strong> ${email}</p>
          <p><strong>電話:</strong> ${phone || '-'}</p>
          <p><strong>予算:</strong> ${budget || '-'}</p>
          <p><strong>希望条件:</strong> ${requirements || '-'}</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 12px; border: 1px solid #ddd;">No.</th>
                <th style="padding: 12px; border: 1px solid #ddd;">選手名</th>
                <th style="padding: 12px; border: 1px solid #ddd;">年</th>
                <th style="padding: 12px; border: 1px solid #ddd;">カード名</th>
                <th style="padding: 12px; border: 1px solid #ddd;">番号</th>
              </tr>
            </thead>
            <tbody>
              ${cardsHtml}
            </tbody>
          </table>

          <p><a href="${req.protocol}://${req.get('host')}/admin">管理ダッシュボード</a></p>
        </div>
      `
    });

    res.json({
      success: true,
      message: '代行依頼を受け付けました',
      requestId,
      myPageUrl
    });

  } catch (error) {
    console.error('代行依頼エラー:', error);
    res.status(500).json({ error: '依頼の処理に失敗しました' });
  }
});

// 代行依頼情報取得
app.get('/api/agency-request/:requestId', (req, res) => {
  const { requestId } = req.params;

  if (!agencyRequests[requestId]) {
    return res.status(404).json({ error: '依頼が見つかりません' });
  }

  res.json(agencyRequests[requestId]);
});

// 代行依頼一覧取得（管理者用）
app.get('/api/agency-requests', basicAuth, (req, res) => {
  const requests = Object.values(agencyRequests).sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(requests);
});

// 代行依頼ステータス更新（管理者用）
app.patch('/api/agency-request/:requestId/status', basicAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, note } = req.body;

    if (!agencyRequests[requestId]) {
      return res.status(404).json({ error: '依頼が見つかりません' });
    }

    agencyRequests[requestId].status = status;
    agencyRequests[requestId].updatedAt = new Date().toISOString();
    agencyRequests[requestId].progress.push({
      timestamp: new Date().toISOString(),
      status,
      note: note || ''
    });

    saveData();

    // 顧客への通知メール
    const statusText = {
      pending: '受付中',
      in_progress: '作業中',
      completed: '完了',
      cancelled: 'キャンセル'
    }[status] || status;

    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: agencyRequests[requestId].email,
      subject: `代行依頼の進捗更新 - ${statusText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">代行依頼の進捗更新</h2>
          <p>${agencyRequests[requestId].customerName} 様</p>
          <p>代行依頼の状態が更新されました。</p>
          <p><strong>ステータス:</strong> ${statusText}</p>
          ${note ? `<p><strong>備考:</strong> ${note}</p>` : ''}
          <p style="margin: 30px 0;">
            <a href="${req.protocol}://${req.get('host')}/mypage/${requestId}"
               style="display: inline-block; padding: 12px 24px; background-color: #007bff;
                      color: white; text-decoration: none; border-radius: 4px;">
              マイページで詳細確認
            </a>
          </p>
        </div>
      `
    });

    res.json({ success: true, message: 'ステータスを更新しました' });
  } catch (error) {
    console.error('ステータス更新エラー:', error);
    res.status(500).json({ error: 'ステータス更新に失敗しました' });
  }
});

// ============================================
// 買取承認API（既存機能）
// ============================================

// 買取承認申請
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

    await transporter.sendMail({
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
    });

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

// 承認リスト取得
app.get('/api/approval-requests', basicAuth, (req, res) => {
  const requests = Object.entries(approvalRequests).map(([key, value]) => ({
    approvalKey: key,
    ...value
  }));
  res.json(requests);
});

// 承認情報取得
app.get('/api/approval/:key', (req, res) => {
  const { key } = req.params;

  if (!approvalRequests[key]) {
    return res.status(404).json({ error: '承認キーが無効です' });
  }

  res.json(approvalRequests[key]);
});

// 承認回答
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

    await transporter.sendMail({
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
    });

    res.json({ success: true, message: '回答を送信しました' });

  } catch (error) {
    console.error('承認回答エラー:', error);
    res.status(500).json({ error: '回答の処理に失敗しました' });
  }
});

// ============================================
// メッセージAPI
// ============================================

// チャットメッセージ送信（Shopifyベース）
app.post('/api/chat/messages', async (req, res) => {
  try {
    const { userId, shopifyId, userName, text, image } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    // Shopifyユーザー専用のチャットキーを作成
    const chatKey = `chat_${shopifyId || userId}`;
    const messageId = uuidv4();

    if (!messages[chatKey]) {
      messages[chatKey] = [];
    }

    messages[chatKey].push({
      messageId,
      userId,
      shopifyId,
      userName,
      text,
      image,
      sender: 'user',
      timestamp: new Date().toISOString(),
      read: false
    });

    saveData();

    // 管理者への通知
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `新しいチャットメッセージ - ${userName}様より`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">新しいチャットメッセージ</h2>
          <p><strong>送信者:</strong> ${userName}</p>
          <p><strong>Shopify ID:</strong> ${shopifyId || '未設定'}</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
            ${text}
          </div>
          <p style="margin: 30px 0;">
            <a href="${req.protocol}://${req.get('host')}/admin"
               style="display: inline-block; padding: 12px 24px; background-color: #007bff;
                      color: white; text-decoration: none; border-radius: 4px;">
              管理画面で返信
            </a>
          </p>
        </div>
      `
    });

    // 自動応答（デモ用）
    setTimeout(() => {
      messages[chatKey].push({
        messageId: uuidv4(),
        text: 'ご連絡ありがとうございます。担当者が確認次第、返信させていただきます。',
        sender: 'support',
        timestamp: new Date().toISOString(),
        read: false
      });
      saveData();
    }, 1000);

    res.json({ success: true, messageId });

  } catch (error) {
    console.error('チャットメッセージ送信エラー:', error);
    res.status(500).json({ error: 'メッセージ送信に失敗しました' });
  }
});

// チャットメッセージ取得（Shopifyベース）
app.get('/api/chat/messages/:userId', (req, res) => {
  const { userId } = req.params;
  const chatKey = `chat_${userId}`;
  res.json(messages[chatKey] || []);
});

// サポートから返信（管理者用）
app.post('/api/chat/reply', basicAuth, async (req, res) => {
  try {
    const { userId, shopifyId, text, customerEmail } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    const chatKey = `chat_${shopifyId || userId}`;
    const messageId = uuidv4();

    if (!messages[chatKey]) {
      messages[chatKey] = [];
    }

    messages[chatKey].push({
      messageId,
      text,
      sender: 'support',
      timestamp: new Date().toISOString(),
      read: false
    });

    saveData();

    // 顧客へのメール通知
    if (customerEmail) {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: customerEmail,
        subject: 'PSA代行サービス - サポートからの返信',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">サポートからの返信</h2>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
              ${text}
            </div>
            <p style="margin: 30px 0;">
              <a href="${req.protocol}://${req.get('host')}/chat"
                 style="display: inline-block; padding: 12px 24px; background-color: #007bff;
                        color: white; text-decoration: none; border-radius: 4px;">
                チャットで確認
              </a>
            </p>
          </div>
        `
      });
    }

    res.json({ success: true, messageId });

  } catch (error) {
    console.error('返信エラー:', error);
    res.status(500).json({ error: '返信に失敗しました' });
  }
});

// メッセージ送信（既存の依頼ベース）
app.post('/api/messages', async (req, res) => {
  try {
    const { requestId, requestType, sender, senderName, message } = req.body;

    if (!requestId || !requestType || !sender || !message) {
      return res.status(400).json({ error: '必須項目が不足しています' });
    }

    // 依頼の存在確認
    const request = requestType === 'agency'
      ? agencyRequests[requestId]
      : approvalRequests[requestId];

    if (!request) {
      return res.status(404).json({ error: '依頼が見つかりません' });
    }

    const messageId = uuidv4();

    if (!messages[requestId]) {
      messages[requestId] = [];
    }

    messages[requestId].push({
      messageId,
      requestType,
      sender,
      senderName,
      message,
      timestamp: new Date().toISOString(),
      read: false
    });

    saveData();

    // メール通知
    const recipient = sender === 'customer' ? process.env.ADMIN_EMAIL : request.email;
    const recipientName = sender === 'customer' ? '管理者' : request.customerName;

    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: recipient,
      subject: `新しいメッセージ - ${senderName}より`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">新しいメッセージ</h2>
          <p>${recipientName} 様</p>
          <p><strong>差出人:</strong> ${senderName}</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
            ${message}
          </div>
          <p style="margin: 30px 0;">
            <a href="${req.protocol}://${req.get('host')}${sender === 'customer' ? '/admin' : '/mypage/' + requestId}"
               style="display: inline-block; padding: 12px 24px; background-color: #007bff;
                      color: white; text-decoration: none; border-radius: 4px;">
              メッセージを確認
            </a>
          </p>
        </div>
      `
    });

    res.json({ success: true, message: 'メッセージを送信しました' });

  } catch (error) {
    console.error('メッセージ送信エラー:', error);
    res.status(500).json({ error: 'メッセージ送信に失敗しました' });
  }
});

// メッセージ取得
app.get('/api/messages/:requestId', (req, res) => {
  const { requestId } = req.params;
  res.json(messages[requestId] || []);
});

// メッセージ既読
app.patch('/api/messages/:requestId/read', (req, res) => {
  const { requestId } = req.params;

  if (messages[requestId]) {
    messages[requestId].forEach(msg => {
      msg.read = true;
    });
    saveData();
  }

  res.json({ success: true });
});

// ============================================
// チャット/メッセージルート
// ============================================

// チャットページ
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../../chat.html'));
});

// メッセージページ（エイリアス）
app.get('/messages', (req, res) => {
  res.sendFile(path.join(__dirname, '../../chat.html'));
});

// ============================================
// 管理者ルート
// ============================================

app.get('/admin', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin/html/dashboard.html'));
});

app.get('/admin/css/:file', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin/css', req.params.file));
});

app.get('/admin/js/:file', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin/js', req.params.file));
});

// ============================================
// 顧客承認ページ（既存）
// ============================================

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

app.get('/approval/:key/css/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/customer/css', req.params.file));
});

app.get('/approval/:key/js/:file', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/customer/js', req.params.file));
});

// ============================================
// バックアップAPI
// ============================================

app.post('/api/backup', basicAuth, (req, res) => {
  try {
    createBackup();
    res.json({ success: true, message: 'バックアップを作成しました' });
  } catch (error) {
    res.status(500).json({ error: 'バックアップに失敗しました' });
  }
});

app.get('/api/backups', basicAuth, (req, res) => {
  try {
    const backups = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup_'))
      .map(file => {
        const stats = fs.statSync(path.join(backupDir, file));
        return {
          name: file,
          date: stats.mtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.date - a.date);

    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: 'バックアップ一覧の取得に失敗しました' });
  }
});

// ============================================
// エラーハンドラー
// ============================================

app.use((req, res) => {
  res.status(404).send('ページが見つかりません');
});

// ============================================
// サーバー起動
// ============================================

// SSL証明書の読み込み
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, '../config/server.key')),
  cert: fs.readFileSync(path.join(__dirname, '../config/server.crt'))
};

// HTTPサーバー起動
http.createServer(app).listen(HTTP_PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 PSA代行統合システム起動`);
  console.log(`${'='.repeat(50)}`);
  console.log(`📍 HTTPサーバー: http://localhost:${HTTP_PORT}`);
  console.log(`📍 管理ダッシュボード: http://localhost:${HTTP_PORT}/admin`);
  console.log(`📍 ユーザー: admin / #collection30`);
  console.log(`${'='.repeat(50)}\n`);
});

// HTTPSサーバー起動
https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`🔒 HTTPSサーバー: https://localhost:${HTTPS_PORT}`);
});
