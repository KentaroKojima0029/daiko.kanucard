const { shopifyApi, ApiVersion } = require('@shopify/shopify-api');
require('@shopify/shopify-api/adapters/node');

// Shopify設定
const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP_NAME;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

let shopify = null;

// Shopify APIクライアントの初期化
function initShopify() {
  if (!SHOPIFY_SHOP || !SHOPIFY_ACCESS_TOKEN) {
    console.warn('Shopify credentials not configured. Customer lookup will be disabled.');
    return null;
  }

  shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY || 'not-needed-for-custom-app',
    apiSecretKey: process.env.SHOPIFY_API_SECRET || 'not-needed-for-custom-app',
    scopes: ['read_customers', 'read_orders'],
    hostName: SHOPIFY_SHOP,
    apiVersion: ApiVersion.October24,
    isEmbeddedApp: false,
    isCustomStoreApp: true,
    adminApiAccessToken: SHOPIFY_ACCESS_TOKEN,
  });

  return shopify;
}

// GraphQL クライアントの作成
function createGraphQLClient() {
  if (!shopify || !SHOPIFY_SHOP || !SHOPIFY_ACCESS_TOKEN) {
    return null;
  }

  const session = {
    shop: `${SHOPIFY_SHOP}.myshopify.com`,
    accessToken: SHOPIFY_ACCESS_TOKEN,
    state: 'online',
    isOnline: true,
  };

  return new shopify.clients.Graphql({ session });
}

// 携帯番号で顧客を検索
async function findCustomerByPhone(phoneNumber) {
  const client = createGraphQLClient();

  if (!client) {
    console.warn('Shopify client not available');
    return null;
  }

  try {
    // 電話番号を正規化（Shopifyの形式に合わせる）
    const normalizedPhone = phoneNumber.replace(/[\s-]/g, '');

    const query = `
      query findCustomer($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node {
              id
              email
              firstName
              lastName
              phone
              tags
              ordersCount
              totalSpent
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const response = await client.query({
      data: {
        query,
        variables: {
          query: `phone:${normalizedPhone}`,
        },
      },
    });

    const customers = response.body.data.customers.edges;

    if (customers.length === 0) {
      return null;
    }

    return customers[0].node;
  } catch (error) {
    console.error('Shopify customer lookup error:', error);
    return null;
  }
}

// 顧客IDで詳細情報を取得
async function getCustomerById(customerId) {
  const client = createGraphQLClient();

  if (!client) {
    return null;
  }

  try {
    const query = `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          phone
          tags
          ordersCount
          totalSpent
          createdAt
          updatedAt
          addresses {
            address1
            address2
            city
            province
            country
            zip
          }
          orders(first: 10) {
            edges {
              node {
                id
                name
                createdAt
                totalPrice
                financialStatus
                fulfillmentStatus
              }
            }
          }
        }
      }
    `;

    const response = await client.query({
      data: {
        query,
        variables: {
          id: customerId,
        },
      },
    });

    return response.body.data.customer;
  } catch (error) {
    console.error('Shopify customer detail error:', error);
    return null;
  }
}

// 顧客の注文履歴を取得
async function getCustomerOrders(customerId, limit = 20) {
  const client = createGraphQLClient();

  if (!client) {
    return [];
  }

  try {
    const query = `
      query getOrders($id: ID!, $first: Int!) {
        customer(id: $id) {
          orders(first: $first, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                totalPrice
                financialStatus
                fulfillmentStatus
                lineItems(first: 10) {
                  edges {
                    node {
                      title
                      quantity
                      variant {
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await client.query({
      data: {
        query,
        variables: {
          id: customerId,
          first: limit,
        },
      },
    });

    return response.body.data.customer?.orders.edges.map(edge => edge.node) || [];
  } catch (error) {
    console.error('Shopify orders error:', error);
    return [];
  }
}

// 初期化
initShopify();

module.exports = {
  findCustomerByPhone,
  getCustomerById,
  getCustomerOrders,
};
