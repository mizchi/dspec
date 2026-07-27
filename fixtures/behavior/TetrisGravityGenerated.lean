/-! Generated from Pkl transition system tetris.gravity-lock.behavior-v1. Do not edit by hand. -/

namespace DspecGenerated

structure State where
  «drop-distance» : Nat
  «piece-present» : Nat
  «locked-piece-count» : Nat
  deriving Repr, DecidableEq

inductive Action where
  | gravity
  | lock
  deriving Repr, DecidableEq

def initial : State := { «drop-distance» := 2, «piece-present» := 1, «locked-piece-count» := 0 }

def denote (state : State) (action : Action) : Option State :=
  match action with
  | .gravity =>
    if state.«piece-present» = 1 ∧ 1 ≤ state.«drop-distance» then
      some { «drop-distance» := (state.«drop-distance» - 1), «piece-present» := state.«piece-present», «locked-piece-count» := state.«locked-piece-count» }
    else
      none
  | .lock =>
    if state.«piece-present» = 1 ∧ state.«drop-distance» = 0 then
      some { «drop-distance» := state.«drop-distance», «piece-present» := 0, «locked-piece-count» := (state.«locked-piece-count» + 1) }
    else
      none

def renderState (state : State) : String :=
  "drop-distance=" ++ toString state.«drop-distance» ++ ";" ++ "piece-present=" ++ toString state.«piece-present» ++ ";" ++ "locked-piece-count=" ++ toString state.«locked-piece-count»

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
  "dspec-conformance|path=gravity(-)|" ++
    renderTrace (run initial [.gravity]),
  "dspec-conformance|path=lock(-)|" ++
    renderTrace (run initial [.lock]),
  "dspec-conformance|path=gravity(-)>gravity(-)|" ++
    renderTrace (run initial [.gravity, .gravity]),
  "dspec-conformance|path=gravity(-)>lock(-)|" ++
    renderTrace (run initial [.gravity, .lock]),
  "dspec-conformance|path=lock(-)>gravity(-)|" ++
    renderTrace (run initial [.lock, .gravity]),
  "dspec-conformance|path=lock(-)>lock(-)|" ++
    renderTrace (run initial [.lock, .lock]),
  "dspec-conformance|path=gravity(-)>gravity(-)>gravity(-)|" ++
    renderTrace (run initial [.gravity, .gravity, .gravity]),
  "dspec-conformance|path=gravity(-)>gravity(-)>lock(-)|" ++
    renderTrace (run initial [.gravity, .gravity, .lock]),
  "dspec-conformance|path=gravity(-)>lock(-)>gravity(-)|" ++
    renderTrace (run initial [.gravity, .lock, .gravity]),
  "dspec-conformance|path=gravity(-)>lock(-)>lock(-)|" ++
    renderTrace (run initial [.gravity, .lock, .lock]),
  "dspec-conformance|path=lock(-)>gravity(-)>gravity(-)|" ++
    renderTrace (run initial [.lock, .gravity, .gravity]),
  "dspec-conformance|path=lock(-)>gravity(-)>lock(-)|" ++
    renderTrace (run initial [.lock, .gravity, .lock]),
  "dspec-conformance|path=lock(-)>lock(-)>gravity(-)|" ++
    renderTrace (run initial [.lock, .lock, .gravity]),
  "dspec-conformance|path=lock(-)>lock(-)>lock(-)|" ++
    renderTrace (run initial [.lock, .lock, .lock])
]

#eval boundedConformance

end DspecGenerated
