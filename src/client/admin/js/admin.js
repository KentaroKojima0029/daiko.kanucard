// グローバル変数
let cardCount = 0;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    // 初期カードを追加
    addCard();

    // イベントリスナーの設定
    document.getElementById('addCardBtn').addEventListener('click', addCard);
    document.getElementById('approvalForm').addEventListener('submit', handleSubmit);
    document.getElementById('refreshBtn').addEventListener('click', loadApprovalList);

    // 承認リストの読み込み
    loadApprovalList();
});

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
                削除
            </button>
        </div>
        <div class="card-item-fields">
            <div class="form-group">
                <label for="playerName-${cardCount}">選手名 *</label>
                <input type="text" id="playerName-${cardCount}" name="playerName-${cardCount}" required>
            </div>
            <div class="form-group">
                <label for="year-${cardCount}">年 *</label>
                <input type="text" id="year-${cardCount}" name="year-${cardCount}" required>
            </div>
            <div class="form-group">
                <label for="cardName-${cardCount}">カード名 *</label>
                <input type="text" id="cardName-${cardCount}" name="cardName-${cardCount}" required>
            </div>
            <div class="form-group">
                <label for="number-${cardCount}">番号 *</label>
                <input type="text" id="number-${cardCount}" name="number-${cardCount}" required>
            </div>
            <div class="form-group">
                <label for="gradeLevel-${cardCount}">グレードレベル *</label>
                <select id="gradeLevel-${cardCount}" name="gradeLevel-${cardCount}" required>
                    <option value="">選択してください</option>
                    <option value="PSA 10">PSA 10</option>
                    <option value="PSA 9">PSA 9</option>
                    <option value="PSA 8">PSA 8</option>
                    <option value="PSA 7">PSA 7</option>
                    <option value="PSA 6">PSA 6</option>
                    <option value="PSA 5">PSA 5</option>
                    <option value="PSA 4">PSA 4</option>
                    <option value="PSA 3">PSA 3</option>
                    <option value="PSA 2">PSA 2</option>
                    <option value="PSA 1">PSA 1</option>
                </select>
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

    // カード情報の収集
    const cards = [];
    const cardItems = document.querySelectorAll('.card-item');

    cardItems.forEach((item, index) => {
        const id = item.id.split('-')[1];
        cards.push({
            playerName: document.getElementById(`playerName-${id}`).value,
            year: document.getElementById(`year-${id}`).value,
            cardName: document.getElementById(`cardName-${id}`).value,
            number: document.getElementById(`number-${id}`).value,
            gradeLevel: document.getElementById(`gradeLevel-${id}`).value
        });
    });

    if (cards.length === 0) {
        showMessage('カード情報を追加してください', 'error');
        return;
    }

    try {
        const response = await fetch('/api/approval-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customerName,
                email,
                cards
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('承認申請を送信しました', 'success');
            document.getElementById('approvalForm').reset();

            // カードコンテナをクリア
            document.getElementById('cardsContainer').innerHTML = '';
            cardCount = 0;
            addCard();

            // リストを更新
            loadApprovalList();
        } else {
            showMessage(data.error || '送信に失敗しました', 'error');
        }
    } catch (error) {
        console.error('エラー:', error);
        showMessage('送信に失敗しました', 'error');
    }
}

// 承認リストの読み込み
async function loadApprovalList() {
    try {
        const response = await fetch('/api/approval-requests');
        const requests = await response.json();

        const tbody = document.getElementById('approvalTableBody');
        tbody.innerHTML = '';

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">データがありません</td></tr>';
            return;
        }

        requests.reverse().forEach(request => {
            const row = document.createElement('tr');

            const date = new Date(request.createdAt);
            const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

            const statusClass = request.status === 'completed' ? 'status-completed' : 'status-pending';
            const statusText = request.status === 'completed' ? '完了' : '保留中';

            row.innerHTML = `
                <td>${dateStr}</td>
                <td>${request.customerName}</td>
                <td>${request.email}</td>
                <td>${request.cards.length}枚</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td><span class="approval-key">${request.approvalKey.substring(0, 8)}...</span></td>
            `;

            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('エラー:', error);
        showMessage('リストの読み込みに失敗しました', 'error');
    }
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
