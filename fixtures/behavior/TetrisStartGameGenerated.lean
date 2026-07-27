/-! Generated from Pkl transition system tetris.start-game.behavior-v1. Do not edit by hand. -/

namespace DspecGenerated

structure State where
  «game-exists» : Nat
  «game-status» : Nat
  «active-piece-count» : Nat
  deriving Repr, DecidableEq

inductive Action where
  | startGame («spawn-open» : Nat)
  deriving Repr, DecidableEq

def initial : State := { «game-exists» := 0, «game-status» := 0, «active-piece-count» := 0 }

def denote (state : State) (action : Action) : Option State :=
  match action with
  | .startGame «spawn-open» =>
    if state.«game-exists» = 0 ∧ «spawn-open» = 1 then
      some { «game-exists» := 1, «game-status» := 0, «active-piece-count» := 1 }
    else
      none

def renderState (state : State) : String :=
  "game-exists=" ++ toString state.«game-exists» ++ ";" ++ "game-status=" ++ toString state.«game-status» ++ ";" ++ "active-piece-count=" ++ toString state.«active-piece-count»

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
  "dspec-conformance|path=startGame(spawn-open=0)|" ++
    renderTrace (run initial [.startGame 0]),
  "dspec-conformance|path=startGame(spawn-open=1)|" ++
    renderTrace (run initial [.startGame 1])
]

#eval boundedConformance

end DspecGenerated
