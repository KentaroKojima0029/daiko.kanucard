// OTP認証フローのテスト
const fetch = require('node-fetch');

async function testOTPFlow() {
  const email = 'kn24012300@gmail.com';
  const baseUrl = 'http://localhost:3000';

  console.log('=== OTP認証フローテスト開始 ===');
  console.log('メール:', email);
  console.log('');

  // 電話番号の入力を促す
  const phone = await new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('Shopifyに登録されている電話番号を入力してください: ', (answer) => {
      readline.close();
      resolve(answer.trim());
    });
  });

  console.log('入力された電話番号:', phone);
  console.log('');

  try {
    // ステップ1: OTP送信
    console.log('1. OTP送信リクエスト...');
    const otpResponse = await fetch(`${baseUrl}/api/auth/verify-shopify-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone })
    });

    const otpResult = await otpResponse.json();
    console.log('OTP送信結果:', otpResult);

    if (!otpResponse.ok) {
      throw new Error(`OTP送信失敗: ${otpResult.message}`);
    }

    // OTPをコンソールから取得（実際のテストではメールから取得）
    const otp = await new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question('\nメールで受信したOTPコードを入力してください: ', (answer) => {
        readline.close();
        resolve(answer.trim());
      });
    });

    // ステップ2: OTP検証
    console.log('\n2. OTP検証リクエスト...');
    console.log('入力されたOTP:', otp);

    const verifyResponse = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });

    const verifyResult = await verifyResponse.json();
    console.log('OTP検証結果:', verifyResult);

    if (!verifyResponse.ok) {
      throw new Error(`OTP検証失敗: ${verifyResult.message}`);
    }

    console.log('\n✅ 認証成功！');
    console.log('トークン:', verifyResult.token);

  } catch (error) {
    console.error('\n❌ エラー:', error.message);
  }
}

// node-fetchがない場合はインストール
try {
  require('node-fetch');
} catch {
  console.log('node-fetchをインストールしています...');
  require('child_process').execSync('npm install node-fetch@2', { stdio: 'inherit' });
}

testOTPFlow();