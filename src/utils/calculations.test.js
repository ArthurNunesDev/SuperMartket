import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateItemSubtotal,
  calculatePurchaseTotal,
  formatQuantity,
  parseQuantity,
  sanitizeQuantityInput,
} from "./calculations.js";

test("calculates a weighted product subtotal using integer cents", () => {
  assert.equal(calculateItemSubtotal(2500, 3490), 8725);
});

test("calculates the purchase total from item subtotals", () => {
  assert.equal(calculatePurchaseTotal([
    { quantityMilli: 2500, unitPriceCents: 3490 },
    { quantityMilli: 1000, unitPriceCents: 1299 },
  ]), 10024);
});

test("parses decimal quantities using Brazilian comma notation", () => {
  assert.equal(parseQuantity("2,5"), 2500);
  assert.equal(parseQuantity("0,125"), 125);
});

test("rejects invalid or non-positive quantities", () => {
  assert.equal(parseQuantity("0"), null);
  assert.equal(parseQuantity("-1"), null);
  assert.equal(parseQuantity("1,2345"), null);
  assert.equal(parseQuantity("abc"), null);
});

test("sanitizes quantity input and limits it to three decimal places", () => {
  assert.equal(sanitizeQuantityInput("abc 2.5,6789"), "2,567");
  assert.equal(sanitizeQuantityInput("1.234"), "1,234");
  assert.equal(sanitizeQuantityInput("3kg"), "3");
});

test("formats fractional quantities for display", () => {
  assert.equal(formatQuantity(2500), "2,5");
});
