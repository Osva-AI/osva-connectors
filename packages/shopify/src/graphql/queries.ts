/** Fixed Admin GraphQL documents (connector-owned, read-only). */

export const SHOP_GET_QUERY = `#graphql
  query OsvaShopGet {
    shop {
      id
      name
      myshopifyDomain
      currencyCode
      ianaTimezone
    }
  }
`;

export const PRODUCT_LIST_QUERY = `#graphql
  query OsvaProductList($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      nodes {
        id
        title
        handle
        status
        vendor
        productType
        createdAt
        updatedAt
        variants(first: 10) {
          nodes {
            id
            title
            sku
            price
          }
          pageInfo {
            hasNextPage
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const PRODUCT_GET_QUERY = `#graphql
  query OsvaProductGet($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      vendor
      productType
      createdAt
      updatedAt
      description
      tags
      variants(first: 10) {
        nodes {
          id
          title
          sku
          price
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  }
`;

export const ORDER_LIST_QUERY = `#graphql
  query OsvaOrderList($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      nodes {
        id
        name
        createdAt
        updatedAt
        displayFinancialStatus
        displayFulfillmentStatus
        currentTotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const ORDER_GET_QUERY = `#graphql
  query OsvaOrderGet($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      updatedAt
      displayFinancialStatus
      displayFulfillmentStatus
      currencyCode
      currentTotalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      currentSubtotalPriceSet {
        shopMoney {
          amount
        }
      }
      currentTotalTaxSet {
        shopMoney {
          amount
        }
      }
      lineItems(first: 25) {
        nodes {
          id
          name
          quantity
          currentQuantity
          sku
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  }
`;

export const LOCATION_LIST_QUERY = `#graphql
  query OsvaLocationList($first: Int!, $after: String) {
    locations(first: $first, after: $after) {
      nodes {
        id
        name
        isActive
        fulfillsOnlineOrders
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const INVENTORY_LEVELS_BY_LOCATION_QUERY = `#graphql
  query OsvaInventoryLevelsByLocation($locationId: ID!, $first: Int!, $after: String) {
    location(id: $locationId) {
      id
      inventoryLevels(first: $first, after: $after) {
        nodes {
          id
          item {
            id
          }
          location {
            id
          }
          quantities(names: ["available", "on_hand", "committed", "incoming", "reserved"]) {
            name
            quantity
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export const INVENTORY_LEVELS_BY_ITEM_QUERY = `#graphql
  query OsvaInventoryLevelsByItem($inventoryItemId: ID!, $first: Int!, $after: String) {
    inventoryItem(id: $inventoryItemId) {
      id
      inventoryLevels(first: $first, after: $after) {
        nodes {
          id
          item {
            id
          }
          location {
            id
          }
          quantities(names: ["available", "on_hand", "committed", "incoming", "reserved"]) {
            name
            quantity
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;
