// 電話番号正規化関数のテスト

// 電話番号正規化関数（server.jsから複製）
function normalizePhoneNumber(phone) {
  if (!phone) return null;

  // 文字列に変換
  let normalized = String(phone).trim();

  // すべての空白、ハイフン、括弧を除去
  normalized = normalized.replace(/[\s\-\(\)]/g, '');

  // +81で始まる場合は0に変換（日本の国際形式）
  if (normalized.startsWith('+81')) {
    normalized = '0' + normalized.substring(3);
  } else if (normalized.startsWith('81') && normalized.length >= 11) {
    // 81で始まる場合も0に変換（+が省略されている場合）
    normalized = '0' + normalized.substring(2);
  }

  // 数字以外を除去
  normalized = normalized.replace(/\D/g, '');

  return normalized;
}

// 電話番号比較関数
function comparePhoneNumbers(phone1, phone2) {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);

  if (!normalized1 || !normalized2) {
    return false;
  }

  return normalized1 === normalized2;
}

// テストケース
const testCases = [
  // 同じ電話番号の異なるフォーマット
  { phone1: '090-1234-5678', phone2: '09012345678', expected: true },
  { phone1: '+81-90-1234-5678', phone2: '09012345678', expected: true },
  { phone1: '+819012345678', phone2: '090-1234-5678', expected: true },
  { phone1: '8190-1234-5678', phone2: '090-1234-5678', expected: true },
  { phone1: '81 90 1234 5678', phone2: '090-1234-5678', expected: true },

  // 異なる電話番号
  { phone1: '090-1234-5678', phone2: '080-1234-5678', expected: false },
  { phone1: '090-1234-5678', phone2: '090-1234-5679', expected: false },

  // null/undefined
  { phone1: null, phone2: '090-1234-5678', expected: false },
  { phone1: '090-1234-5678', phone2: null, expected: false },
];

console.log('=== 電話番号正規化テスト ===\n');

let passedCount = 0;
let failedCount = 0;

testCases.forEach((testCase, index) => {
  const result = comparePhoneNumbers(testCase.phone1, testCase.phone2);
  const passed = result === testCase.expected;

  if (passed) {
    passedCount++;
    console.log(`✅ テスト ${index + 1}: PASS`);
  } else {
    failedCount++;
    console.log(`❌ テスト ${index + 1}: FAIL`);
    console.log(`   phone1: "${testCase.phone1}" → "${normalizePhoneNumber(testCase.phone1)}"`);
    console.log(`   phone2: "${testCase.phone2}" → "${normalizePhoneNumber(testCase.phone2)}"`);
    console.log(`   期待値: ${testCase.expected}, 実際: ${result}`);
  }
});

console.log(`\n=== テスト結果 ===`);
console.log(`合格: ${passedCount} / ${testCases.length}`);
console.log(`不合格: ${failedCount} / ${testCases.length}`);

if (failedCount === 0) {
  console.log('\n🎉 すべてのテストが合格しました！');
} else {
  console.log('\n⚠️  一部のテストが失敗しました。');
  process.exit(1);
}
