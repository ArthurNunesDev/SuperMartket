import test from "node:test";
import assert from "node:assert/strict";
import { filterShoppingItems, getSessionParticipantNames } from "./itemFilters.js";

const items = [
  { id: "1", name: "Arroz integral", addedByName: "Arthur" },
  { id: "2", name: "Feijão", addedByName: "María" },
  { id: "3", name: "Arroz branco", addedByName: "Maria" },
  { id: "4", name: "Leite", addedByName: "Arthur" },
];

test("filters item names without case or accent sensitivity", () => {
  assert.deepEqual(filterShoppingItems(items, "ARROZ").map((item) => item.id), ["1", "3"]);
  assert.deepEqual(filterShoppingItems(items, "feijao").map((item) => item.id), ["2"]);
});

test("filters by participant and combines participant with product search", () => {
  assert.deepEqual(filterShoppingItems(items, "", "arthur").map((item) => item.id), ["1", "4"]);
  assert.deepEqual(filterShoppingItems(items, "arroz", "maria").map((item) => item.id), ["3"]);
});

test("returns unique participant names and ignores missing names", () => {
  assert.deepEqual(
    getSessionParticipantNames([...items, { id: "5", name: "Açúcar", addedByName: " ARTHUR " }, { id: "6", name: "Sal" }]),
    ["Arthur", "María"]
  );
});

test("returns no results for a participant who did not add matching products", () => {
  assert.deepEqual(filterShoppingItems(items, "arroz", "Maria").map((item) => item.id), ["3"]);
  assert.deepEqual(filterShoppingItems(items, "", "João"), []);
});
