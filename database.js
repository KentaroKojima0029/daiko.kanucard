const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'daiko.db'));

// データベース初期化
function initDatabase() {
  // ユーザーテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      phone_number TEXT UNIQUE,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 認証コードテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      verified BOOLEAN DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 代行依頼テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      plan TEXT NOT NULL,
      service_option TEXT NOT NULL,
      purchase_offer TEXT,
      return_method TEXT,
      inspection_option TEXT,
      items TEXT NOT NULL,
      total_quantity INTEGER,
      total_declared_value REAL,
      total_acquisition_value REAL,
      total_fee TEXT,
      estimated_tax TEXT,
      estimated_grading_fee TEXT,
      total_estimated_fee TEXT,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // セッショ���テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // お問い合わせテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('Database initialized successfully');
}

// クエリオブジェクトを初期化（モジュールロード時に実行）
const userQueries = {
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  findByPhoneNumber: db.prepare('SELECT * FROM users WHERE phone_number = ?'),
  create: db.prepare(`
    INSERT INTO users (email, phone_number, name)
    VALUES (?, ?, ?)
  `),
  update: db.prepare(`
    UPDATE users
    SET email = ?, name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
};

// 認証コード操作
const verificationQueries = {
  create: db.prepare(`
    INSERT INTO verification_codes (phone_number, code, expires_at)
    VALUES (?, ?, ?)
  `),
  findLatest: db.prepare(`
    SELECT * FROM verification_codes
    WHERE phone_number = ? AND verified = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `),
  markAsVerified: db.prepare(`
    UPDATE verification_codes
    SET verified = 1
    WHERE id = ?
  `),
  incrementAttempts: db.prepare(`
    UPDATE verification_codes
    SET attempts = attempts + 1
    WHERE id = ?
  `),
  deleteExpired: db.prepare(`
    DELETE FROM verification_codes
    WHERE expires_at <= datetime('now')
  `),
};

// 代行依頼操作
const submissionQueries = {
  findById: db.prepare('SELECT * FROM form_submissions WHERE id = ?'),
  findByEmail: db.prepare('SELECT * FROM form_submissions WHERE email = ? ORDER BY created_at DESC'),
  findByUserId: db.prepare('SELECT * FROM form_submissions WHERE user_id = ? ORDER BY created_at DESC'),
  create: db.prepare(`
    INSERT INTO form_submissions (
      user_id, email, name, plan, service_option, purchase_offer, return_method,
      inspection_option, items, total_quantity, total_declared_value, total_acquisition_value,
      total_fee, estimated_tax, estimated_grading_fee, total_estimated_fee, message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateStatus: db.prepare('UPDATE form_submissions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
};

// セッション操作
const sessionQueries = {
  findByToken: db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"),
  create: db.prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'),
  delete: db.prepare('DELETE FROM sessions WHERE token = ?'),
  deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')"),
};

// お問い合わせ操作
const contactQueries = {
  findById: db.prepare('SELECT * FROM contacts WHERE id = ?'),
  findByUserId: db.prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC'),
  create: db.prepare(`
    INSERT INTO contacts (user_id, name, email, subject, message)
    VALUES (?, ?, ?, ?, ?)
  `),
  updateStatus: db.prepare('UPDATE contacts SET status = ? WHERE id = ?'),
};

module.exports = {
  db,
  initDatabase,
  userQueries,
  verificationQueries,
  submissionQueries,
  sessionQueries,
  contactQueries,
};
