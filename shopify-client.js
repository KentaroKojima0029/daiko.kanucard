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
    hostName: `${SHOPIFY_SHOP}.myshopify.com`,
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
    console.warn('[Shopify] Client creation failed - missing credentials');
    return null;
  }

  try {
    const session = {
      shop: `${SHOPIFY_SHOP}.myshopify.com`,
      accessToken: SHOPIFY_ACCESS_TOKEN,
    };

    console.log('[Shopify] Creating GraphQL client for shop:', session.shop);

    return new shopify.clients.Graphql({ session });
  } catch (error) {
    console.error('[Shopify] GraphQL client creation error:', error);
    return null;
  }
}

// メールアドレスで顧客を検索
async function findCustomerByEmail(email) {
  const client = createGraphQLClient();

  if (!client) {
    console.warn('Shopify client not available');
    return null;
  }

  try {
    console.log('[Shopify Debug] Searching for email:', { email });

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
              defaultAddress {
                phone
              }
              tags
              numberOfOrders
              amountSpent {
                amount
              }
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    console.log('[Shopify Debug] GraphQL request details:', {
      shop: `${SHOPIFY_SHOP}.myshopify.com`,
      hasToken: !!SHOPIFY_ACCESS_TOKEN,
      query: `email:${email}`
    });

    const response = await client.request(query, {
      variables: {
        query: `email:${email}`,
      },
    });

    console.log('[Shopify Debug] GraphQL response received:', {
      hasData: !!response.data,
      customersCount: response.data?.customers?.edges?.length || 0
    });

    const customers = response.data.customers.edges;

    console.log('[Shopify Debug] Found customers:', customers.length);

    if (customers.length > 0) {
      const customer = customers[0].node;
      // Normalize phone field - use defaultAddress phone if main phone is null
      if (!customer.phone && customer.defaultAddress?.phone) {
        customer.phone = customer.defaultAddress.phone;
      }
      return customer;
    }

    console.warn('[Shopify Debug] No customer found for email:', email);
    return null;
  } catch (error) {
    console.error('Shopify customer lookup error:', error);
    return null;
  }
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

    console.log('[Shopify Debug] Searching for phone:', {
      original: phoneNumber,
      normalized: normalizedPhone
    });

    const query = `
      query findCustomer($query: String!) {
        customers(first: 5, query: $query) {
          edges {
            node {
              id
              email
              firstName
              lastName
              phone
              defaultAddress {
                phone
              }
              tags
              numberOfOrders
              amountSpent {
                amount
              }
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    // 複数のフォーマットで検索を試みる
    const searchFormats = [
      `phone:${normalizedPhone}`,
      `phone:*${normalizedPhone.slice(-10)}*`,  // 末尾10桁で部分一致
      `phone:+81${normalizedPhone.replace(/^0/, '')}`,  // 国際形式
      `phone:${normalizedPhone.replace(/^\+81/, '0')}`,  // 日本形式
    ];

    for (const searchQuery of searchFormats) {
      console.log('[Shopify Debug] Trying query:', searchQuery);

      const response = await client.request(query, {
        variables: {
          query: searchQuery,
        },
      });

      const customers = response.data.customers.edges;

      console.log('[Shopify Debug] Found customers:', customers.length);
      if (customers.length > 0) {
        console.log('[Shopify Debug] Customer phone data:',
          customers.map(c => ({
            phone: c.node.phone,
            addressPhone: c.node.defaultAddress?.phone
          })));
      }

      if (customers.length > 0) {
        const customer = customers[0].node;
        // Normalize phone field - use defaultAddress phone if main phone is null
        if (!customer.phone && customer.defaultAddress?.phone) {
          customer.phone = customer.defaultAddress.phone;
        }
        return customer;
      }
    }

    console.warn('[Shopify Debug] No customer found for phone:', phoneNumber);
    return null;
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

    const response = await client.request(query, {
      variables: {
        id: customerId,
      },
    });

    const customer = response.data.customer;
    // Normalize phone field - use defaultAddress phone if main phone is null
    if (customer && !customer.phone && customer.addresses?.[0]?.phone) {
      customer.phone = customer.addresses[0].phone;
    }
    return customer;
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

    const response = await client.request(query, {
      variables: {
        id: customerId,
        first: limit,
      },
    });

    return response.data.customer?.orders.edges.map(edge => edge.node) || [];
  } catch (error) {
    console.error('Shopify orders error:', error);
    return [];
  }
}

// 初期化
initShopify();

// 全顧客リストを取得（デバッグ用）
async function listAllCustomers(limit = 10) {
  const client = createGraphQLClient();

  if (!client) {
    return { error: 'Shopify client not available' };
  }

  try {
    const query = `
      query listCustomers($limit: Int!) {
        customers(first: $limit, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              email
              firstName
              lastName
              phone
              defaultAddress {
                phone
              }
              tags
              numberOfOrders
              amountSpent {
                amount
              }
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const response = await client.request(query, {
      variables: {
        limit,
      },
    });

    const customers = response.data.customers.edges.map(edge => edge.node);

    return {
      success: true,
      count: customers.length,
      customers: customers.map(c => ({
        id: c.id,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'No name',
        email: c.email || 'No email',
        phone: c.phone || c.defaultAddress?.phone || 'No phone',
        ordersCount: c.numberOfOrders,
        totalSpent: c.amountSpent?.amount || '0',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }))
    };
  } catch (error) {
    console.error('List customers error:', error);
    return {
      success: false,
      error: error.message,
      details: error.response?.errors || error.stack
    };
  }
}

module.exports = {
  findCustomerByEmail,
  findCustomerByPhone,
  getCustomerById,
  getCustomerOrders,
  listAllCustomers,
};
