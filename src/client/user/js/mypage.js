// グローバル変数
let requestId = '';
let requestData = null;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  // テーマ初期化
  initTheme();

  // URLからrequestIdを取得
  const pathParts = window.location.pathname.split('/');
  requestId = pathParts[pathParts.length - 1];

  if (!requestId) {
    showError('依頼IDが見つかりません');
    return;
  }

  // データ読み込み
  loadRequestData();
  loadMessages();

  // イベントリスナー設定
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('messageForm').addEventListener('submit', handleMessageSubmit);

  // 定期的にデータを更新（30秒ごと）
  setInterval(() => {
    loadRequestData();
    loadMessages();
  }, 30000);
});

// テーマ初期化
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

// テーマ切替
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

// テーマアイコン更新
function updateThemeIcon(theme) {
  const icon = document.querySelector('.theme-icon');
  icon.textContent = theme === 'light' ? '🌙' : '☀️';
}

// 依頼データ読み込み
async function loadRequestData() {
  try {
    const response = await fetch(`/api/agency-request/${requestId}`);

    if (!response.ok) {
      throw new Error('依頼が見つかりません');
    }

    requestData = await response.json();
    displayRequestData();

  } catch (error) {
    console.error('エラー:', error);
    showError(error.message || 'データの読み込みに失敗しました');
  }
}

// 依頼データ表示
function displayRequestData() {
  document.getElementById('loadingMessage').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';

  // ステータスバッジ
  const statusBadge = document.getElementById('statusBadge');
  const statusText = {
    pending: '受付中',
    in_progress: '作業中',
    completed: '完了',
    cancelled: 'キャンセル'
  }[requestData.status] || requestData.status;

  statusBadge.textContent = statusText;
  statusBadge.className = `status-badge status-${requestData.status}`;

  // 日時情報
  document.getElementById('createdAt').textContent = formatDate(requestData.createdAt);
  document.getElementById('updatedAt').textContent = formatDate(requestData.updatedAt);
  document.getElementById('requestId').textContent = requestData.requestId;

  // 顧客情報
  document.getElementById('customerName').textContent = requestData.customerName;
  document.getElementById('customerEmail').textContent = requestData.email;
  document.getElementById('customerPhone').textContent = requestData.phone || '-';
  document.getElementById('budget').textContent = requestData.budget || '-';

  // カード情報
  const cardsTableBody = document.getElementById('cardsTableBody');
  cardsTableBody.innerHTML = '';

  requestData.cards.forEach((card, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${card.playerName}</td>
      <td>${card.year || '-'}</td>
      <td>${card.cardName}</td>
      <td>${card.number || '-'}</td>
    `;
    cardsTableBody.appendChild(row);
  });

  // ご要望
  if (requestData.requirements) {
    document.getElementById('requirementsSection').style.display = 'block';
    document.getElementById('requirements').textContent = requestData.requirements;
  }

  // 進捗タイムライン
  displayProgress();
}

// 進捗表示
function displayProgress() {
  const timeline = document.getElementById('progressTimeline');
  timeline.innerHTML = '';

  if (!requestData.progress || requestData.progress.length === 0) {
    timeline.innerHTML = '<p class="no-messages">進捗情報がありません</p>';
    return;
  }

  // 最新の進捗を上に表示
  const sortedProgress = [...requestData.progress].reverse();

  sortedProgress.forEach(item => {
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item';

    const statusText = {
      pending: '受付中',
      in_progress: '作業中',
      completed: '完了',
      cancelled: 'キャンセル'
    }[item.status] || item.status;

    timelineItem.innerHTML = `
      <div class="timeline-time">${formatDate(item.timestamp)}</div>
      <div class="timeline-status">${statusText}</div>
      ${item.note ? `<div class="timeline-note">${item.note}</div>` : ''}
    `;

    timeline.appendChild(timelineItem);
  });
}

// メッセージ読み込み
async function loadMessages() {
  try {
    const response = await fetch(`/api/messages/${requestId}`);
    const messages = await response.json();

    displayMessages(messages);

    // 既読マーク
    if (messages.length > 0) {
      await fetch(`/api/messages/${requestId}/read`, {
        method: 'PATCH'
      });
    }

  } catch (error) {
    console.error('メッセージ読み込みエラー:', error);
  }
}

// メッセージ表示
function displayMessages(messages) {
  const messagesList = document.getElementById('messagesList');
  messagesList.innerHTML = '';

  if (messages.length === 0) {
    messagesList.innerHTML = '<div class="no-messages">まだメッセージはありません</div>';
    return;
  }

  messages.forEach(msg => {
    const messageItem = document.createElement('div');
    messageItem.className = `message-item message-${msg.sender}`;

    messageItem.innerHTML = `
      <div class="message-header">
        <span class="message-sender">${msg.senderName}</span>
        <span class="message-time">${formatDate(msg.timestamp)}</span>
      </div>
      <div class="message-content">${msg.message}</div>
    `;

    messagesList.appendChild(messageItem);
  });

  // スクロールを最下部へ
  messagesList.scrollTop = messagesList.scrollHeight;
}

// メッセージ送信
async function handleMessageSubmit(e) {
  e.preventDefault();

  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value.trim();

  if (!message) {
    return;
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestId,
        requestType: 'agency',
        sender: 'customer',
        senderName: requestData.customerName,
        message
      })
    });

    const data = await response.json();

    if (response.ok) {
      messageInput.value = '';
      loadMessages();
      showMessage('メッセージを送信しました', 'success');
    } else {
      showMessage(data.error || 'メッセージ送信に失敗しました', 'error');
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="btn-icon">📧</span> 送信';

  } catch (error) {
    console.error('メッセージ送信エラー:', error);
    showMessage('メッセージ送信に失敗しました', 'error');

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="btn-icon">📧</span> 送信';
  }
}

// 日時フォーマット
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

// エラー表示
function showError(message) {
  document.getElementById('loadingMessage').style.display = 'none';
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

// メッセージ表示
function showMessage(message, type) {
  const messageBox = document.getElementById('messageBox');
  messageBox.textContent = message;
  messageBox.className = `message-box ${type} show`;

  setTimeout(() => {
    messageBox.classList.remove('show');
  }, 3000);
}
