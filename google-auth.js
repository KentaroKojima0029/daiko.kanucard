const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const database = require('./database');
const { findCustomerByEmail } = require('./shopify-client');

console.log('[Google Auth] Initializing Google OAuth 2.0');

// Passport セッション設定
passport.serializeUser((user, done) => {
  console.log('[Google Auth] Serializing user:', user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  console.log('[Google Auth] Deserializing user:', id);
  try {
    const user = database.userQueries.findById.get(id);
    if (user) {
      done(null, user);
    } else {
      done(new Error('User not found'), null);
    }
  } catch (error) {
    console.error('[Google Auth] Deserialization error:', error);
    done(error, null);
  }
});

// Google OAuth Strategy
function initGoogleStrategy() {
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

  console.log('[Google Auth] Strategy config:', {
    clientID: process.env.GOOGLE_CLIENT_ID ? '***' + process.env.GOOGLE_CLIENT_ID.slice(-4) : 'NOT SET',
    callbackURL: callbackURL
  });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[Google Auth] Google OAuth credentials not configured. Google login will be disabled.');
    return false;
  }

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL,
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('[Google Auth] OAuth callback received for:', {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName
      });

      const email = profile.emails?.[0]?.value;

      if (!email) {
        console.error('[Google Auth] No email in Google profile');
        return done(new Error('Googleアカウントからメールアドレスを取得できませんでした'));
      }

      // Shopifyで顧客を検索
      console.log('[Google Auth] Looking up Shopify customer for:', email);
      const shopifyCustomer = await findCustomerByEmail(email);

      if (!shopifyCustomer) {
        console.warn('[Google Auth] Customer not found in Shopify:', email);
        return done(null, false, {
          message: 'このGoogleアカウントのメールアドレスはShopifyに登録されていません。先にShopifyでアカウントを作成してください。'
        });
      }

      console.log('[Google Auth] Shopify customer found:', {
        email: shopifyCustomer.email,
        name: `${shopifyCustomer.firstName} ${shopifyCustomer.lastName}`
      });

      // ローカルデータベースでユーザーを検索または作成
      let user = database.userQueries.findByPhoneNumber.get(email);

      if (!user) {
        console.log('[Google Auth] Creating new user in database');
        const fullName = `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim();
        const result = database.userQueries.create.run(
          shopifyCustomer.email,
          email, // phone_numberフィールドにemailを格納
          fullName || profile.displayName || null
        );
        user = database.userQueries.findById.get(result.lastInsertRowid);
      } else {
        console.log('[Google Auth] Updating existing user');
        const fullName = `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim();
        database.userQueries.update.run(shopifyCustomer.email, fullName || profile.displayName, user.id);
        user = database.userQueries.findById.get(user.id);
      }

      console.log('[Google Auth] Authentication successful for user:', user.id);
      return done(null, user);
    } catch (error) {
      console.error('[Google Auth] Authentication error:', error);
      return done(error);
    }
  }));

  console.log('[Google Auth] Google Strategy initialized successfully');
  return true;
}

module.exports = {
  passport,
  initGoogleStrategy
};
