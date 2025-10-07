const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { userQueries, sessionQueries } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// JWTトークンを生成
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// JWTトークンを検証
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// セッションを作成
function createSession(userId) {
  const sessionId = uuidv4();
  const token = generateToken(userId);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY).toISOString();

  sessionQueries.create.run(sessionId, userId, token, expiresAt);

  return token;
}

// 認証ミドルウェア
function authenticate(req, res, next) {
  const token = req.cookies.auth_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: '無効なトークンです' });
  }

  const session = sessionQueries.findByToken.get(token);
  if (!session) {
    return res.status(401).json({ error: 'セッションが見つかりません' });
  }

  const user = userQueries.findById.get(session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'ユーザーが見つかりません' });
  }

  req.user = user;
  req.session = session;
  next();
}

// オプショナル認証ミドルウェア（ログインしていなくてもOK）
function optionalAuthenticate(req, res, next) {
  const token = req.cookies.auth_token || req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const session = sessionQueries.findByToken.get(token);
      if (session) {
        const user = userQueries.findById.get(session.user_id);
        if (user) {
          req.user = user;
          req.session = session;
        }
      }
    }
  }

  next();
}

// ユーザーまたはメールでログイン
function findOrCreateUser(email, name = null, shopifyCustomerId = null, shopifyAccessToken = null) {
  let user = userQueries.findByEmail.get(email);

  if (!user) {
    const result = userQueries.create.run(email, name, shopifyCustomerId, shopifyAccessToken);
    user = userQueries.findById.get(result.lastInsertRowid);
  } else if (shopifyCustomerId && user.shopify_customer_id !== shopifyCustomerId) {
    userQueries.update.run(name, shopifyCustomerId, shopifyAccessToken, user.id);
    user = userQueries.findById.get(user.id);
  }

  return user;
}

// ログアウト
function logout(token) {
  sessionQueries.delete.run(token);
}

// 期限切れセッションをクリーンアップ
function cleanupExpiredSessions() {
  sessionQueries.deleteExpired.run();
}

// 定期的にクリーンアップ（1時間ごと）
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = {
  generateToken,
  verifyToken,
  createSession,
  authenticate,
  optionalAuthenticate,
  findOrCreateUser,
  logout,
  cleanupExpiredSessions,
};
