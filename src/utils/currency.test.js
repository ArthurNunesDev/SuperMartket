import test from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, parseCurrency } from "./currency.js";

test("parses Brazilian currency values into integer cents", () => {
  assert.equal(parseCurrency("34,90"), 3490);
  assert.equal(parseCurrency("1.234,56"), 123456);
  assert.equal(parseCurrency("12.5"), 1250);
});

test("accepts zero and rejects invalid currency values", () => {
  assert.equal(parseCurrency("0,00"), 0);
  assert.equal(parseCurrency("-1,00"), null);
  assert.equal(parseCurrency("12,999"), null);
  assert.equal(parseCurrency("abc"), null);
});

test("formats integer cents as Brazilian currency", () => {
  assert.equal(formatCurrency(3490), "R$ 34,90");
});