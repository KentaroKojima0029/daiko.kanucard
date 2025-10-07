// 認証チェック - すべてのページで読み込む
(async function() {
    // ログインページ自体は認証チェックをスキップ
    if (window.location.pathname === '/login.html' || window.location.pathname === '/login') {
        return;
    }

    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });

        if (!response.ok) {
            // 未認証の場合、ログインページにリダイレクト
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();

        // グローバルに現在のユーザー情報を保存
        window.currentUser = data.user;
        window.shopifyCustomer = data.shopifyCustomer;

        // ユーザー情報表示イベントを発火
        window.dispatchEvent(new CustomEvent('userLoaded', { detail: data }));
    } catch (error) {
        console.error('Authentication check failed:', error);
        window.location.href = '/login.html';
    }
})();

// ログアウト関数
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout failed:', error);
        window.location.href = '/login.html';
    }
}
