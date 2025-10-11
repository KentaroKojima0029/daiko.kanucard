const { findCustomerByPhone, getCustomerById } = require('./shopify-client');
const logger = require('./logger');

// Shopify API接続テスト
async function testShopifyConnection() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    overall: 'pending'
  };

  logger.info('Starting Shopify API connection test');

  // テスト1: 環境変数の確認
  const envTest = {
    name: '環境変数チェック',
    status: 'pending',
    details: {}
  };

  try {
    const shopName = process.env.SHOPIFY_SHOP_NAME;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    envTest.details.shopName = shopName ? `設定済み (${shopName})` : '未設定';
    envTest.details.accessToken = accessToken ? '設定済み (***...)' : '未設定';

    if (shopName && accessToken) {
      envTest.status = 'passed';
      envTest.message = 'Shopify環境変数が正しく設定されています';
    } else {
      envTest.status = 'failed';
      envTest.message = 'Shopify環境変数が不足しています';
    }
  } catch (error) {
    envTest.status = 'error';
    envTest.message = error.message;
  }

  results.tests.push(envTest);

  // テスト2: Shopify API疎通確認（ダミー電話番号で検索）
  const apiTest = {
    name: 'Shopify API疎通確認',
    status: 'pending',
    details: {}
  };

  try {
    // 存在しない電話番号で検索（エラーが返るかAPI呼び出しが成功するか確認）
    const testPhone = '+819012345678';
    const customer = await findCustomerByPhone(testPhone);

    apiTest.status = 'passed';
    apiTest.message = 'Shopify APIへの接続に成功しました';
    apiTest.details.searchResult = customer ? '顧客が見つかりました' : '顧客が見つかりませんでした（正常）';
    apiTest.details.testPhone = testPhone;

    if (customer) {
      apiTest.details.customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      apiTest.details.customerEmail = customer.email;
    }
  } catch (error) {
    apiTest.status = 'failed';
    apiTest.message = `Shopify API接続エラー: ${error.message}`;
    apiTest.details.error = error.message;
    apiTest.details.stack = error.stack;
  }

  results.tests.push(apiTest);

  // 総合結果の判定
  const allPassed = results.tests.every(test => test.status === 'passed');
  const anyFailed = results.tests.some(test => test.status === 'failed' || test.status === 'error');

  if (allPassed) {
    results.overall = 'success';
    results.message = 'すべてのテストに合格しました';
  } else if (anyFailed) {
    results.overall = 'failure';
    results.message = '一部のテストに失敗しました';
  }

  logger.info('Shopify API test completed', { overall: results.overall });

  return results;
}

// データベース接続テスト
async function testDatabaseConnection() {
  const { db } = require('./database');
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    overall: 'pending'
  };

  logger.info('Starting database connection test');

  // テスト1: データベースファイルの存在確認
  const fileTest = {
    name: 'データベースファイル確認',
    status: 'pending',
    details: {}
  };

  try {
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(__dirname, 'daiko.db');

    fileTest.details.path = dbPath;
    fileTest.details.exists = fs.existsSync(dbPath) ? 'はい' : 'いいえ';

    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      fileTest.details.size = `${stats.size} bytes`;
      fileTest.details.created = stats.birthtime.toISOString();
      fileTest.status = 'passed';
      fileTest.message = 'データベースファイルが存在します';
    } else {
      fileTest.status = 'warning';
      fileTest.message = 'データベースファイルが見つかりません（初回起動時に自動作成されます）';
    }
  } catch (error) {
    fileTest.status = 'error';
    fileTest.message = error.message;
  }

  results.tests.push(fileTest);

  // テスト2: テーブルの存在確認
  const tableTest = {
    name: 'テーブル構造確認',
    status: 'pending',
    details: { tables: [] }
  };

  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    tableTest.details.tables = tables.map(t => t.name);
    tableTest.details.count = tables.length;

    const requiredTables = ['users', 'verification_codes', 'form_submissions', 'sessions', 'contacts'];
    const missingTables = requiredTables.filter(t => !tableTest.details.tables.includes(t));

    if (missingTables.length === 0) {
      tableTest.status = 'passed';
      tableTest.message = 'すべての必要なテーブルが存在します';
    } else {
      tableTest.status = 'warning';
      tableTest.message = `一部のテーブルが見つかりません: ${missingTables.join(', ')}`;
      tableTest.details.missing = missingTables;
    }
  } catch (error) {
    tableTest.status = 'error';
    tableTest.message = error.message;
  }

  results.tests.push(tableTest);

  // 総合結果
  const allPassed = results.tests.every(test => test.status === 'passed' || test.status === 'warning');
  results.overall = allPassed ? 'success' : 'failure';
  results.message = allPassed ? 'データベース接続テスト完了' : 'データベース接続に問題があります';

  logger.info('Database test completed', { overall: results.overall });

  return results;
}

// システム全体のヘルスチェック
async function healthCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {}
  };

  try {
    // Shopifyテスト
    results.checks.shopify = await testShopifyConnection();

    // データベーステスト
    results.checks.database = await testDatabaseConnection();

    // 環境変数チェック
    results.checks.environment = {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000,
      jwtConfigured: !!process.env.JWT_SECRET,
      twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    };

    // 総合ステータス
    const shopifyFailed = results.checks.shopify.overall === 'failure';
    const databaseFailed = results.checks.database.overall === 'failure';

    if (shopifyFailed || databaseFailed) {
      results.status = 'unhealthy';
      results.message = 'システムの一部に問題があります';
    } else {
      results.status = 'healthy';
      results.message = 'システムは正常に動作しています';
    }

  } catch (error) {
    results.status = 'unhealthy';
    results.message = error.message;
    results.error = error.stack;
  }

  return results;
}

module.exports = {
  testShopifyConnection,
  testDatabaseConnection,
  healthCheck
};
