/-! Generated from Pkl transition system commerce.purchase.behavior-v1. Do not edit by hand. -/

namespace DspecGenerated

structure State where
  available : Nat
  deriving Repr, DecidableEq

inductive Action where
  | purchase (quantity : Nat)
  deriving Repr, DecidableEq

def initial : State := { available := 10 }

def denote (state : State) (action : Action) : Option State :=
  match action with
  | .purchase quantity =>
    if quantity ≤ state.available then
      some { available := (state.available - quantity) }
    else
      none

def renderState (state : State) : String :=
  "available=" ++ toString state.available

def run (state : State) : List Action → List (Bool × State)
  | [] => []
  | action :: rest =>
    match denote state action with
    | some next => (true, next) :: run next rest
    | none => (false, state) :: run state rest

def renderStep (entry : Bool × State) : String :=
  match entry with
  | (accepted, state) => (if accepted then "accepted:" else "rejected:") ++ renderState state

def renderTrace : List (Bool × State) → String
  | [] => ""
  | step :: [] => renderStep step
  | step :: rest => renderStep step ++ ">" ++ renderTrace rest

def boundedConformance : List String := [
  "dspec-conformance|path=purchase(quantity=0)|" ++
    renderTrace (run initial [.purchase 0]),
  "dspec-conformance|path=purchase(quantity=10)|" ++
    renderTrace (run initial [.purchase 10])
]

#eval boundedConformance

end DspecGenerated
