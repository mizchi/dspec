import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  domainPacks,
  validateDomainPacks,
} from "../src/core/domain-pack-validation.mjs";

describe("Domain Pack validation core", () => {
  it("validates pack IDs and helper contracts in deterministic order", () => {
    const errors = validateDomainPacks({
      domainPacks: [
        { id: "duplicate-pack", helpers: [] },
        { id: "duplicate-pack", helpers: [] },
        {
          id: "bad-pack",
          helpers: [
            {
              id: "helper",
              returns: "rule",
              emitsTypedAst: false,
              predicates: [],
            },
            {
              id: "helper",
              returns: "rule",
              emitsTypedAst: true,
              predicates: [],
            },
            {
              id: "typed-term",
              returns: "term",
              emitsTypedAst: true,
              predicates: [],
            },
          ],
        },
      ],
    });

    assert.deepEqual(errors, [
      "duplicate domain pack id: duplicate-pack",
      "domain pack rule helper must emit typed ast: bad-pack.helper",
      "duplicate domain pack helper id: bad-pack.helper",
      "domain pack typed ast helper has no predicates: bad-pack.helper",
      "domain pack typed ast helper has no predicates: bad-pack.typed-term",
    ]);
  });

  it("accepts a valid registry and exposes the typed accessor", () => {
    const model = {
      domainPacks: [{
        id: "pack",
        helpers: [{
          id: "rule-helper",
          returns: "rule",
          emitsTypedAst: true,
          predicates: ["predicate"],
        }],
      }],
    };

    assert.deepEqual(validateDomainPacks(model), []);
    assert.deepEqual(domainPacks(model).map(({ id }) => id), ["pack"]);
    assert.deepEqual(domainPacks(null), []);
  });
});
