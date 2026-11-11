import test from "node:test";
import assert from "node:assert/strict";
import {
  findDuplicateProduct,
  getFrequentProducts,
  normalizeProductName,
  productNameSimilarity,
} from "./productMatching.js";

test("normalizes accents, case and whitespace", () => {
  assert.equal(normalizeProductName("  SABÃO   em PÓ "), "sabao em po");
});

test("recognizes accent differences and adjacent typing errors", () => {
  assert.equal(productNameSimilarity("Sabao", "saboa"), 0.8);
  assert.equal(findDuplicateProduct([{ id: "1", name: "Sabão" }], "saboa")?.item.id, "1");
  assert.equal(findDuplicateProduct([{ id: "2", name: "Arroz" }], "arros")?.item.id, "2");
});

test("keeps products with different package sizes separate", () => {
  assert.equal(findDuplicateProduct([{ id: "1", name: "Leite 1L" }], "Leite 2L"), null);
  assert.equal(findDuplicateProduct([{ id: "2", name: "Arroz 5kg" }], "Arroz 1kg"), null);
  assert.equal(findDuplicateProduct([{ id: "3", name: "Café 500g" }], "Café 500ml"), null);
});

test("does not match unrelated short names", () => {
  assert.equal(findDuplicateProduct([{ id: "1", name: "Coca" }], "coco"), null);
  assert.equal(findDuplicateProduct([{ id: "1", name: "Arroz" }], "Feijão"), null);
});

test("ignores the item currently being edited", () => {
  const items = [{ id: "1", name: "Arroz" }, { id: "2", name: "Feijão" }];
  assert.equal(findDuplicateProduct(items, "arros", "1")?.item.id, undefined);
});

test("groups frequent products despite simple typing mistakes", () => {
  const products = getFrequentProducts([
    { status: "completed", completedAt: "2026-11-01", items: [{ name: "Sabão", quantityMilli: 1000 }] },
    { status: "completed", completedAt: "2026-11-02", items: [{ name: "Saboa", quantityMilli: 2000 }] },
  ]);
  assert.equal(products.length, 1);
  assert.equal(products[0].count, 2);
  assert.equal(products[0].quantityMilli, 2000);
});

test("counts a product once per purchase and keeps latest quantity", () => {
  const products = getFrequentProducts([
    { status: "completed", completedAt: "2026-11-01", items: [{ name: "Arroz", quantityMilli: 1000 }, { name: "ARROZ", quantityMilli: 2000 }] },
    { status: "completed", completedAt: "2026-11-02", items: [{ name: "Arroz", quantityMilli: 3000 }] },
  ]);
  assert.equal(products.length, 1);
  assert.equal(products[0].count, 2);
  assert.equal(products[0].quantityMilli, 3000);
});
