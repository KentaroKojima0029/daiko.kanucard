// グローバル変数
let approvalKey = '';
let approvalData = null;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  // URLから承認キーを取得
  const pathParts = window.location.pathname.split('/');
  approvalKey = pathParts[2]; // /approval/{key}

  if (!approvalKey) {
    showError('承認キーが見つかりません');
    return;
  }

  // データ読み込み
  loadApprovalData();

  // フォーム送信
  const form = document.getElementById('approvalForm');
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }
});

// 承認データ読み込み
async function loadApprovalData() {
  try {
    const response = await fetch(`/api/approval/${approvalKey}`);

    if (!response.ok) {
      throw new Error('承認キーが無効です');
    }

    approvalData = await response.json();
    displayApprovalData();

  } catch (error) {
    console.error('エラー:', error);
    showError(error.message || 'データの読み込みに失敗しました');
  }
}

// 承認データ表示
function displayApprovalData() {
  // ローディングメッセージを非表示
  const loadingMessage = document.getElementById('loadingMessage');
  if (loadingMessage) {
    loadingMessage.style.display = 'none';
  }

  // メインコンテンツを表示
  const mainContent = document.getElementById('mainContent');
  if (mainContent) {
    mainContent.style.display = 'block';
  }

  // 顧客情報表示
  document.getElementById('customerName').textContent = approvalData.customerName;
  document.getElementById('customerEmail').textContent = approvalData.email;

  // カード情報表示
  const cardsContainer = document.getElementById('cardsContainer');
  cardsContainer.innerHTML = '';

  approvalData.cards.forEach((card, index) => {
    const cardItem = document.createElement('div');
    cardItem.className = 'card-item';

    cardItem.innerHTML = `
      <div class="card-item-header">
        <h3>カード ${index + 1}</h3>
      </div>
      <div class="card-item-details">
        <div class="detail-row">
          <span class="label">選手名:</span>
          <span class="value">${card.playerName}</span>
        </div>
        <div class="detail-row">
          <span class="label">年:</span>
          <span class="value">${card.year}</span>
        </div>
        <div class="detail-row">
          <span class="label">カード名:</span>
          <span class="value">${card.cardName}</span>
        </div>
        <div class="detail-row">
          <span class="label">番号:</span>
          <span class="value">${card.number}</span>
        </div>
        <div class="detail-row">
          <span class="label">グレードレベル:</span>
          <span class="value">${card.gradeLevel}</span>
        </div>
      </div>
      <div class="approval-options">
        <label class="approval-option">
          <input type="radio" name="approval-${index}" value="approved" required>
          <span class="option-label approved">✓ 承認</span>
        </label>
        <label class="approval-option">
          <input type="radio" name="approval-${index}" value="rejected" required>
          <span class="option-label rejected">✗ 拒否</span>
        </label>
        <label class="approval-option">
          <input type="radio" name="approval-${index}" value="pending" required>
          <span class="option-label pending">⏸ 保留</span>
        </label>
      </div>
    `;

    cardsContainer.appendChild(cardItem);
  });
}

// フォーム送信処理
async function handleSubmit(e) {
  e.preventDefault();

  // 回答を収集
  const responses = {};

  approvalData.cards.forEach((card, index) => {
    const selected = document.querySelector(`input[name="approval-${index}"]:checked`);
    if (selected) {
      responses[index] = selected.value;
    }
  });

  // すべて選択されているか確認
  if (Object.keys(responses).length !== approvalData.cards.length) {
    showMessage('すべてのカードについて選択してください', 'error');
    return;
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';

    const response = await fetch(`/api/approval/${approvalKey}/response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ responses })
    });

    const data = await response.json();

    if (response.ok) {
      // 成功メッセージ表示
      document.getElementById('mainContent').style.display = 'none';
      const completedMessage = document.getElementById('completedMessage');
      if (completedMessage) {
        completedMessage.style.display = 'block';
      }
    } else {
      showMessage(data.error || '送信に失敗しました', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '回答を送信';
    }

  } catch (error) {
    console.error('エラー:', error);
    showMessage('送信に失敗しました', 'error');

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = '回答を送信';
  }
}

// エラー表示
function showError(message) {
  const loadingMessage = document.getElementById('loadingMessage');
  if (loadingMessage) {
    loadingMessage.style.display = 'none';
  }

  const errorMessage = document.getElementById('errorMessage');
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
  }
}

// メッセージ表示
function showMessage(message, type) {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.className = `message-box ${type} show`;

    setTimeout(() => {
      messageBox.classList.remove('show');
    }, 3000);
  }
}
