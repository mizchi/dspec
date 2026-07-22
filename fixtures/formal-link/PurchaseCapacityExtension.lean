import CommercePurchaseGenerated

/-!
Direct Lean extension of the generated purchase transition model.

The source model remains `CommercePurchaseGenerated.lean`; this file adds a
named theorem that the formal-link registry can associate with a domain rule.
-/

namespace DspecExtension

open DspecGenerated

theorem purchase_never_increases
    (state : State) (quantity : Nat) (next : State)
    (accepted : denote state (.purchase quantity) = some next) :
    next.available ≤ state.available := by
  by_cases withinAvailable : quantity ≤ state.available
  · rw [denote, if_pos withinAvailable] at accepted
    injection accepted with accepted
    subst next
    exact Nat.sub_le _ _
  · rw [denote, if_neg withinAvailable] at accepted
    contradiction

end DspecExtension
