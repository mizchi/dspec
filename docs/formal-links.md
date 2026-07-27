# Direct Lean / Alloy Links

`dspec.FormalLinks` keeps direct formal source visible from the domain model.
It is for the cases where the closed dspec DSL is too small, while avoiding an
untracked second specification.

There are three authoring modes across dspec:

| Mode | Formal source | Review contract |
| --- | --- | --- |
| generated | dspec DSL emits Lean or Alloy | generated file must match its DSL model exactly |
| authored | a directly maintained Lean/Alloy file | the file and every claim explicitly name a domain rule |
| extension | direct source imports/opens generated source | it must declare each generated dependency and add named claims |

The master remains the natural-language `model: d.Model`. A formal link is not
an automatic translation proof from Japanese/English prose to an arbitrary
theorem: `Claim.rule` is an explicit, reviewable assertion that the named
theorem or Alloy command grounds that rule.

```pkl
import "../dspec/FormalLinks.pkl" as f

formalLinks: f.FormalLinks = new {
  artifacts {
    f.extension(
      "purchase.capacity.generated-lean-extension",
      "lean",
      "fixtures/formal-link/PurchaseCapacityExtension.lean",
      new Listing {
        f.generated("fixtures/behavior/CommercePurchaseGenerated.lean", "CommercePurchaseGenerated")
      },
      new Listing {
        f.leanProof("purchase.capacity.generated-proof", "PURCHASE-CAPACITY", "purchase_never_increases")
      },
    )
  }
}
```

The corresponding Lean file imports the generated module and adds its proof:

```lean
import CommercePurchaseGenerated

theorem purchase_never_increases ... := by
  ...
```

For Alloy, an extension opens the generated module and registers a direct
bounded `check`:

```alloy
open CommerceReservationGenerated

assert ExtensionOwnerCapacity { ... }
check ExtensionOwnerCapacity for exactly 2 Customer, exactly 2 Product, 4 steps
```

Run `pkf run formal-links:verify`. It first confirms the two generated sources
are fresh, then checks paths, rule ids, `import`/`open` links, theorem/check
anchors, and executes Lean 4 and Alloy 6. Lean success is kernel typechecking
of the named source; Alloy success is bounded to the command's declared scope.
