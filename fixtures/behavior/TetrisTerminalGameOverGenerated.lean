/-! Generated from Pkl transition system tetris.terminal-game-over.behavior-v1. Do not edit by hand. -/

namespace DspecGenerated

structure State where
  «game-status» : Nat
  deriving Repr, DecidableEq

inductive Action where
  | translate
  | rotate
  | gravity
  | lock
  deriving Repr, DecidableEq

def initial : State := { «game-status» := 1 }

def denote (state : State) (action : Action) : Option State :=
  match action with
  | .translate =>
    if state.«game-status» = 0 then
      some { «game-status» := 0 }
    else
      none
  | .rotate =>
    if state.«game-status» = 0 then
      some { «game-status» := 0 }
    else
      none
  | .gravity =>
    if state.«game-status» = 0 then
      some { «game-status» := 0 }
    else
      none
  | .lock =>
    if state.«game-status» = 0 then
      some { «game-status» := 0 }
    else
      none

def renderState (state : State) : String :=
  "game-status=" ++ toString state.«game-status»

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
  "dspec-conformance|path=translate(-)|" ++
    renderTrace (run initial [.translate]),
  "dspec-conformance|path=rotate(-)|" ++
    renderTrace (run initial [.rotate]),
  "dspec-conformance|path=gravity(-)|" ++
    renderTrace (run initial [.gravity]),
  "dspec-conformance|path=lock(-)|" ++
    renderTrace (run initial [.lock])
]

#eval boundedConformance

end DspecGenerated
