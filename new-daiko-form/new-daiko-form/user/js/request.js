// グローバル変数
let cardCount = 0;
let mypageUrl = '';

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  // テーマ初期化
  initTheme();

  // 初期カードを追加
  addCard();

  // イベントリスナー設定
  document.getElementById('addCardBtn').addEventListener('click', addCard);
  document.getElementById('agencyRequestForm').addEventListener('submit', handleSubmit);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('copyUrlBtn').addEventListener('click', copyUrl);
  document.getElementById('gotoMypageBtn').addEventListener('click', gotoMypage);
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

// カード追加
function addCard() {
  cardCount++;
  const cardsContainer = document.getElementById('cardsContainer');

  const cardItem = document.createElement('div');
  cardItem.className = 'card-item';
  cardItem.id = `card-${cardCount}`;

  cardItem.innerHTML = `
    <div class="card-item-header">
      <h4>カード ${cardCount}</h4>
      <button type="button" class="btn btn-danger" onclick="removeCard(${cardCount})">
        🗑️ 削除
      </button>
    </div>
    <div class="card-item-fields">
      <div class="form-group">
        <label for="playerName-${cardCount}">選手名 <span class="required">*</span></label>
        <input type="text" id="playerName-${cardCount}" required
               placeholder="例: 大谷翔平">
      </div>
      <div class="form-group">
        <label for="year-${cardCount}">年</label>
        <input type="text" id="year-${cardCount}"
               placeholder="例: 2018">
      </div>
      <div class="form-group">
        <label for="cardName-${cardCount}">カード名 <span class="required">*</span></label>
        <input type="text" id="cardName-${cardCount}" required
               placeholder="例: Topps Chrome">
      </div>
      <div class="form-group">
        <label for="number-${cardCount}">番号</label>
        <input type="text" id="number-${cardCount}"
               placeholder="例: #1">
      </div>
    </div>
  `;

  cardsContainer.appendChild(cardItem);
}

// カード削除
function removeCard(id) {
  const cardItem = document.getElementById(`card-${id}`);
  if (cardItem) {
    cardItem.remove();
  }

  // カードが1つもない場合は1つ追加
  const cardsContainer = document.getElementById('cardsContainer');
  if (cardsContainer.children.length === 0) {
    addCard();
  }
}

// フォーム送信処理
async function handleSubmit(e) {
  e.preventDefault();

  const customerName = document.getElementById('customerName').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const budget = document.getElementById('budget').value;
  const requirements = document.getElementById('requirements').value;

  // カード情報の収集
  const cards = [];
  const cardItems = document.querySelectorAll('.card-item');

  cardItems.forEach((item) => {
    const id = item.id.split('-')[1];
    const playerName = document.getElementById(`playerName-${id}`).value;
    const year = document.getElementById(`year-${id}`).value;
    const cardName = document.getElementById(`cardName-${id}`).value;
    const number = document.getElementById(`number-${id}`).value;

    if (playerName && cardName) {
      cards.push({
        playerName,
        year,
        cardName,
        number
      });
    }
  });

  if (cards.length === 0) {
    showMessage('カード情報を入力してください', 'error');
    return;
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';

    const response = await fetch('/api/agency-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerName,
        email,
        phone,
        budget,
        requirements,
        cards
      })
    });

    const data = await response.json();

    if (response.ok) {
      mypageUrl = data.myPageUrl;
      showSuccessModal();
      document.getElementById('agencyRequestForm').reset();
      document.getElementById('cardsContainer').innerHTML = '';
      cardCount = 0;
      addCard();
    } else {
      showMessage(data.error || '送信に失敗しました', 'error');
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="btn-icon">📧</span> 代行依頼を送信';

  } catch (error) {
    console.error('エラー:', error);
    showMessage('送信に失敗しました。もう一度お試しください。', 'error');

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="btn-icon">📧</span> 代行依頼を送信';
  }
}

// 成功モーダル表示
function showSuccessModal() {
  const modal = document.getElementById('successModal');
  const urlInput = document.getElementById('mypageUrl');
  urlInput.value = mypageUrl;
  modal.classList.add('show');
}

// モーダルを閉じる
function closeModal() {
  const modal = document.getElementById('successModal');
  modal.classList.remove('show');
}

// URLをコピー
function copyUrl() {
  const urlInput = document.getElementById('mypageUrl');
  urlInput.select();
  document.execCommand('copy');
  showMessage('URLをコピーしました', 'success');
}

// マイページへ移動
function gotoMypage() {
  window.location.href = mypageUrl;
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
