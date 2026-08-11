import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  i18nContract,
  validateI18nContract,
  walkLocalizedTexts,
} from "../src/core/i18n-contract-validation.mjs";

describe("i18n contract validation core", () => {
  it("reports required locale and localized label gaps in traversal order", () => {
    const model = {
      locales: ["ja"],
      i18n: {
        requiredLocales: ["en"],
        glossary: [],
      },
      name: {
        default: "名前",
        labels: { ja: "名前" },
      },
      nested: [{
        text: {
          default: "説明",
          labels: {},
        },
      }],
    };
    model.self = model;

    assert.deepEqual(validateI18nContract(model), [
      "i18n required locale is not listed in locales: en",
      "missing localized label: model.name.labels.en",
      "missing localized label: model.nested[0].text.labels.en",
    ]);
  });

  it("reports glossary drift in deterministic entry and locale order", () => {
    assert.deepEqual(validateI18nContract({
      locales: ["ja", "en"],
      vocabulary: [{
        id: "term.product",
        text: {
          default: "商品",
          labels: {
            en: "Product",
            fr: "Produit",
          },
        },
      }],
      i18n: {
        requiredLocales: [],
        glossary: [
          {
            term: "term.product",
            labels: {
              fr: "Article",
              en: "Item",
            },
          },
          {
            term: "term.product",
            labels: { en: "Product" },
          },
          {
            term: "term.missing",
            labels: { en: "Missing" },
          },
        ],
      },
    }), [
      "i18n glossary locale is not listed in locales: term.product.fr",
      "i18n glossary label mismatch: term.product.fr expected \"Article\", actual \"Produit\"",
      "i18n glossary label mismatch: term.product.en expected \"Item\", actual \"Product\"",
      "duplicate i18n glossary term: term.product",
      "unknown i18n glossary term: term.missing",
    ]);
  });

  it("exposes the default contract and cycle-safe localized text walker", () => {
    assert.deepEqual(i18nContract(null), {
      requiredLocales: [],
      glossary: [],
    });

    const root = {
      title: {
        default: "Title",
        labels: { en: "Title" },
      },
    };
    root.self = root;
    const paths = [];

    walkLocalizedTexts(root, "root", (_localized, path) => paths.push(path));

    assert.deepEqual(paths, ["root.title"]);
  });
});
