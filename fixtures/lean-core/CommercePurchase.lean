/-!
  A deliberately small Lean semantic core for the Pkl purchase requirement.

  The first model is intentionally broken: two buyers independently read the
  same stock and both accept. The second model makes purchase atomic.
-/

namespace CommercePurchase

inductive Customer where
  | alice
  | bob
  deriving Repr, DecidableEq

structure Stock where
  available : Nat
  deriving Repr, DecidableEq

structure Purchase where
  customer : Customer
  quantity : Nat
  deriving Repr, DecidableEq

inductive Decision where
  | accepted
  | rejected
  deriving Repr, DecidableEq

def decidePurchase (stock : Stock) (purchase : Purchase) : Decision :=
  if purchase.quantity ≤ stock.available then .accepted else .rejected

/-- Broken read-then-decide behaviour: neither decision sees the other. -/
def brokenConcurrentPurchases (stock : Stock) (left right : Purchase) : Decision × Decision :=
  (decidePurchase stock left, decidePurchase stock right)

def acceptedCount : Decision × Decision → Nat
  | (.accepted, .accepted) => 2
  | (.accepted, .rejected) => 1
  | (.rejected, .accepted) => 1
  | (.rejected, .rejected) => 0

def requestedQuantity (left right : Purchase) : Nat :=
  left.quantity + right.quantity

def brokenOversells (stock : Stock) (left right : Purchase) : Bool :=
  let decisions := brokenConcurrentPurchases stock left right
  acceptedCount decisions == 2 && decide (stock.available < requestedQuantity left right)

def allSmallStocks : List Stock :=
  [{ available := 0 }, { available := 1 }, { available := 2 }]

def aliceOne : Purchase := { customer := .alice, quantity := 1 }
def bobOne : Purchase := { customer := .bob, quantity := 1 }

/-- Finite exploration finds stock=1, two one-unit buyers as an oversell. -/
def finiteBrokenModelFindsOversell : Bool :=
  allSmallStocks.any (fun stock => brokenOversells stock aliceOne bobOne)

example : finiteBrokenModelFindsOversell = true := by
  decide

example : brokenOversells { available := 1 } aliceOne bobOne = true := by
  decide

def brokenWitnessMessage : String :=
  "broken witness: stock=1, accepted=2, requested=2"

#eval brokenWitnessMessage

/-- Atomic purchase transitions update the stock before another purchase reads it. -/
def atomicPurchase (stock : Stock) (purchase : Purchase) : Option Stock :=
  if purchase.quantity ≤ stock.available then
    some { available := stock.available - purchase.quantity }
  else
    none

theorem atomicPurchaseNeverIncreases
    (stock : Stock) (purchase : Purchase) (remaining : Stock)
    (accepted : atomicPurchase stock purchase = some remaining) :
    remaining.available ≤ stock.available := by
  by_cases enough : purchase.quantity ≤ stock.available
  · simp [atomicPurchase, enough] at accepted
    subst remaining
    exact Nat.sub_le _ _
  · simp [atomicPurchase, enough] at accepted

/-- The invariant used by the Pkl `PURCHASE-CAPACITY` requirement. -/
theorem atomicPurchasePreservesCapacity
    (initial stock : Stock) (purchase : Purchase) (remaining : Stock)
    (withinInitialCapacity : stock.available ≤ initial.available)
    (accepted : atomicPurchase stock purchase = some remaining) :
    remaining.available ≤ initial.available := by
  exact Nat.le_trans (atomicPurchaseNeverIncreases stock purchase remaining accepted) withinInitialCapacity

/-- Execute a finite purchase request sequence; rejected requests stutter. -/
def atomicPurchaseTrace (stock : Stock) : List Purchase → Stock
  | [] => stock
  | purchase :: rest =>
    match atomicPurchase stock purchase with
    | some remaining => atomicPurchaseTrace remaining rest
    | none => atomicPurchaseTrace stock rest

/-- Every finite atomic purchase trace stays within its initial capacity. -/
theorem atomicPurchaseTracePreservesCapacity
    (initial stock : Stock) (purchases : List Purchase)
    (withinInitialCapacity : stock.available ≤ initial.available) :
    (atomicPurchaseTrace stock purchases).available ≤ initial.available := by
  induction purchases generalizing stock with
  | nil => simpa [atomicPurchaseTrace] using withinInitialCapacity
  | cons purchase rest inductionHypothesis =>
    simp only [atomicPurchaseTrace]
    split
    · next remaining accepted =>
      exact inductionHypothesis remaining (atomicPurchasePreservesCapacity initial stock purchase remaining withinInitialCapacity accepted)
    · next rejected =>
      exact inductionHypothesis stock withinInitialCapacity

/-! The finite Boolean abstraction used by the Pkl SAT checks. -/

def purchaseRequestedAndStockAvailable (purchaseRequested stockAvailable : Bool) : Bool :=
  purchaseRequested && stockAvailable

def requestedWithoutStockViolatesCapacity (purchaseRequested stockAvailable : Bool) : Bool :=
  purchaseRequested && !stockAvailable && (!purchaseRequested || stockAvailable)

theorem purchaseRequestedAndStockAvailableSat :
    purchaseRequestedAndStockAvailable true true = true := by
  decide

theorem requestedWithoutStockViolatesCapacityUnsat :
    ∀ purchaseRequested stockAvailable : Bool,
      requestedWithoutStockViolatesCapacity purchaseRequested stockAvailable = false := by
  decide

theorem requestedFiveStockFiveSatisfiesCapacity :
    ∃ requested stock : Int, requested = 5 ∧ stock = 5 ∧ requested ≤ stock := by
  exact ⟨5, 5, rfl, rfl, by decide⟩

theorem requestedSevenStockFiveViolatesCapacityUnsat :
    ¬ ∃ requested stock : Int, requested = 7 ∧ stock = 5 ∧ requested ≤ stock := by
  rintro ⟨requested, stock, requestedIsSeven, stockIsFive, withinCapacity⟩
  subst requested
  subst stock
  exact (by decide : ¬ ((7 : Int) ≤ 5)) withinCapacity

def aliceTen : Purchase := { customer := .alice, quantity := 10 }
def fullPurchaseStart : Stock := { available := 10 }
def fullPurchaseEnd : Stock := { available := 0 }

theorem fullPurchaseNextEmptiesStock :
    atomicPurchase fullPurchaseStart aliceTen = some fullPurchaseEnd := by
  decide

theorem fullPurchaseEventuallyEmptiesStock :
    ∃ remaining, atomicPurchase fullPurchaseStart aliceTen = some remaining ∧ remaining.available = 0 := by
  exact ⟨fullPurchaseEnd, by decide, rfl⟩

theorem fullPurchaseTraceAlwaysWithinInitialCapacity :
    ∃ remaining, atomicPurchase fullPurchaseStart aliceTen = some remaining
      ∧ fullPurchaseStart.available ≤ fullPurchaseStart.available
      ∧ remaining.available ≤ fullPurchaseStart.available := by
  exact ⟨fullPurchaseEnd, by decide, by decide, by decide⟩

theorem fullPurchaseDoesNotKeepStockAtTen :
    atomicPurchase fullPurchaseStart aliceTen ≠ some { available := 10 } := by
  decide

/-- The empty trace is the bounded all-path witness for non-eventual emptiness. -/
theorem emptyPurchaseTraceDoesNotEmptyStock :
    atomicPurchaseTrace fullPurchaseStart [] = fullPurchaseStart := by
  rfl

#print axioms atomicPurchasePreservesCapacity
#print axioms atomicPurchaseTracePreservesCapacity
#print axioms purchaseRequestedAndStockAvailableSat
#print axioms requestedWithoutStockViolatesCapacityUnsat
#print axioms requestedFiveStockFiveSatisfiesCapacity
#print axioms requestedSevenStockFiveViolatesCapacityUnsat
#print axioms fullPurchaseNextEmptiesStock
#print axioms fullPurchaseEventuallyEmptiesStock
#print axioms fullPurchaseTraceAlwaysWithinInitialCapacity
#print axioms fullPurchaseDoesNotKeepStockAtTen
#print axioms emptyPurchaseTraceDoesNotEmptyStock

end CommercePurchase
