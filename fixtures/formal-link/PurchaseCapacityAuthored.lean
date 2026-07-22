/-!
An authored Lean reference model for the purchase-capacity rule.

Unlike `PurchaseCapacityExtension.lean`, this is a direct model: it does not
import generated code.  Its link to the natural-language rule is declared in
the formal-links DSL, so the separate authority is visible to reviewers.
-/

namespace CommerceAuthored

def nextAvailable (available quantity : Nat) : Option Nat :=
  if quantity ≤ available then some (available - quantity) else none

theorem purchase_never_increases
    (available quantity next : Nat)
    (accepted : nextAvailable available quantity = some next) :
    next ≤ available := by
  by_cases withinAvailable : quantity ≤ available
  · rw [nextAvailable, if_pos withinAvailable] at accepted
    injection accepted with accepted
    subst next
    exact Nat.sub_le _ _
  · rw [nextAvailable, if_neg withinAvailable] at accepted
    contradiction

end CommerceAuthored
