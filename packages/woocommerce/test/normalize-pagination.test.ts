import { describe, expect, it } from "vitest";

import { mapProductListResponse } from "../src/normalize-woocommerce.js";

describe("WooCommerce pagination headers", () => {
  it("maps X-WP-TotalPages into pageInfo", () => {
    const headers = new Headers({
      "x-wp-total": "25",
      "x-wp-totalpages": "3",
    });
    const result = mapProductListResponse(
      [
        {
          id: 1,
          name: "A",
          slug: "a",
          status: "publish",
          sku: "SKU",
          price: "1.00",
          regular_price: "1.00",
          stock_status: "instock",
          type: "simple",
        },
      ],
      headers,
      2,
    );
    expect(result.pageInfo).toEqual(
      expect.objectContaining({ page: 2, totalPages: 3, hasMore: true }),
    );
  });
});
