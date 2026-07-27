module tetris_board_rotation_alloy_v1

open util/ordering[Column] as column
open util/ordering[Row] as row

sig Column {}
sig Row {}

sig Cell {
  column: one Column,
  row: one Row
}

one sig Board {
  cells: set Cell
}

one sig Tetromino {
  cells: set Cell
}

enum Orientation { north, east, south, west }
enum LastAction { idleAction, rotation, translationLeft }
enum ActionOutcome { idleOutcome, accepted, rejected }
enum SpawnOutcome { spawnStarted, spawnGameOver }
enum SpawnAvailability { spawnOpen, spawnBlocked }

one sig Game {
  var active: set Cell,
  var locked: set Cell,
  var requested: set Cell,
  var priorActive: set Cell,
  var pivot: one Cell,
  var priorPivot: one Cell,
  var orientation: one Orientation,
  var priorOrientation: one Orientation,
  var action: one LastAction,
  var outcome: one ActionOutcome
}

one sig SpawnScenario {
  locked: set Cell,
  spawn: set Cell,
  availability: one SpawnAvailability,
  outcome: one SpawnOutcome
}

fact Geometry {
  #Column = 4
  #Row = 4
  #Board.cells = 16
  Board.cells = Cell
  #Tetromino.cells = 4
  all disj left, right: Cell | left.column != right.column or left.row != right.row
}

fun at[c: set Column, r: set Row]: set Cell { c.~column & r.~row }
fun northShape[p: Cell]: set Cell { at[column/prev[p.column], p.row] + p + at[column/next[p.column], p.row] + at[p.column, row/next[p.row]] }
fun eastShape[p: Cell]: set Cell { at[p.column, row/prev[p.row]] + p + at[p.column, row/next[p.row]] + at[column/prev[p.column], p.row] }
fun southShape[p: Cell]: set Cell { at[column/prev[p.column], p.row] + p + at[column/next[p.column], p.row] + at[p.column, row/prev[p.row]] }
fun westShape[p: Cell]: set Cell { at[p.column, row/prev[p.row]] + p + at[p.column, row/next[p.row]] + at[column/next[p.column], p.row] }
fun shape[p: Cell, o: Orientation]: set Cell {
  (o = north) => northShape[p] else
  (o = east) => eastShape[p] else
  (o = south) => southShape[p] else westShape[p]
}
fun spawnPivot: one Cell { at[column/next[column/first], row/next[row/next[row/first]]] }
fun spawnCells: set Cell { shape[spawnPivot, north] }
fun clockwise[o: Orientation]: one Orientation {
  (o = north) => east else (o = east) => south else (o = south) => west else north
}
fun translateLeft[cells: set Cell]: set Cell {
  { target: Cell | some source: cells | target.row = source.row and target.column = column/prev[source.column] }
}

fact Initial {
  Game.orientation = north
  #shape[Game.pivot, Game.orientation] = 4
  Game.active = shape[Game.pivot, Game.orientation]
  #Game.locked = 1
  Game.active + Game.locked in Board.cells
  no (Game.active & Game.locked)
  Game.priorActive = Game.active
  Game.priorPivot = Game.pivot
  Game.priorOrientation = Game.orientation
  no Game.requested
  Game.action = idleAction
  Game.outcome = idleOutcome
}

fact SpawnScenarioSemantics {
  #SpawnScenario.locked = 1
  #SpawnScenario.spawn = 4
  SpawnScenario.spawn = spawnCells
  (no (SpawnScenario.spawn & SpawnScenario.locked)) implies SpawnScenario.outcome = spawnStarted
  (some (SpawnScenario.spawn & SpawnScenario.locked)) implies SpawnScenario.outcome = spawnGameOver
  (SpawnScenario.availability = spawnOpen) iff (SpawnScenario.outcome = spawnStarted)
}

pred rotate {
  let proposal = shape[Game.pivot, clockwise[Game.orientation]] | {
    #proposal = 4
    no (proposal & Game.locked)
    Game.priorActive' = Game.active
    Game.priorPivot' = Game.pivot
    Game.priorOrientation' = Game.orientation
    Game.active' = proposal
    Game.pivot' = Game.pivot
    Game.orientation' = clockwise[Game.orientation]
    Game.locked' = Game.locked
    Game.requested' = proposal
    Game.action' = rotation
    Game.outcome' = accepted
  }
}

pred rejectRotation {
  let proposal = shape[Game.pivot, clockwise[Game.orientation]] | {
    #proposal != 4 or some (proposal & Game.locked)
    Game.priorActive' = Game.active
    Game.priorPivot' = Game.pivot
    Game.priorOrientation' = Game.orientation
    Game.active' = Game.active
    Game.pivot' = Game.pivot
    Game.orientation' = Game.orientation
    Game.locked' = Game.locked
    Game.requested' = proposal
    Game.action' = rotation
    Game.outcome' = rejected
  }
}

pred acceptTranslateLeft {
  let proposal = translateLeft[Game.active] | {
    #proposal = 4
    no (proposal & Game.locked)
    Game.priorActive' = Game.active
    Game.priorPivot' = Game.pivot
    Game.priorOrientation' = Game.orientation
    Game.active' = proposal
    Game.pivot' = translateLeft[Game.pivot]
    Game.orientation' = Game.orientation
    Game.locked' = Game.locked
    Game.requested' = proposal
    Game.action' = translationLeft
    Game.outcome' = accepted
  }
}

pred rejectTranslateLeft {
  let proposal = translateLeft[Game.active] | {
    #proposal != 4 or some (proposal & Game.locked)
    Game.priorActive' = Game.active
    Game.priorPivot' = Game.pivot
    Game.priorOrientation' = Game.orientation
    Game.active' = Game.active
    Game.pivot' = Game.pivot
    Game.orientation' = Game.orientation
    Game.locked' = Game.locked
    Game.requested' = proposal
    Game.action' = translationLeft
    Game.outcome' = rejected
  }
}

pred stutter {
  Game.priorActive' = Game.active
  Game.priorPivot' = Game.pivot
  Game.priorOrientation' = Game.orientation
  Game.active' = Game.active
  Game.pivot' = Game.pivot
  Game.orientation' = Game.orientation
  Game.locked' = Game.locked
  no Game.requested'
  Game.action' = idleAction
  Game.outcome' = idleOutcome
}

fact Transitions {
  always (rotate or rejectRotation or acceptTranslateLeft or rejectTranslateLeft or stutter)
}

fact Occupancy {
  always (#Game.active = 4 and #Game.locked = 1)
  always (Game.active + Game.locked in Board.cells)
  always no (Game.active & Game.locked)
  always (Game.active = shape[Game.pivot, Game.orientation])
}

assert BoardBounds {
  always (Game.active + Game.locked in Board.cells)
}

check BoardBounds for exactly 16 Cell, exactly 4 Column, exactly 4 Row, 3 steps

assert ActiveAndLockedDisjoint {
  always no (Game.active & Game.locked)
}

check ActiveAndLockedDisjoint for exactly 16 Cell, exactly 4 Column, exactly 4 Row, 3 steps

assert CollisionRotationRejected {
  always ((Game.action = rotation and (#Game.requested != 4 or some (Game.requested & Game.locked))) implies
    (Game.outcome = rejected and Game.active = Game.priorActive and Game.pivot = Game.priorPivot and Game.orientation = Game.priorOrientation))
}

check CollisionRotationRejected for exactly 16 Cell, exactly 4 Column, exactly 4 Row, 3 steps

assert IllegalTranslationRejected {
  always ((Game.action = translationLeft and (#Game.requested != 4 or some (Game.requested & Game.locked))) implies
    (Game.outcome = rejected and Game.active = Game.priorActive and Game.pivot = Game.priorPivot and Game.orientation = Game.priorOrientation))
}

check IllegalTranslationRejected for exactly 16 Cell, exactly 4 Column, exactly 4 Row, 3 steps

assert ClearSpawnStartsGame {
  no (SpawnScenario.spawn & SpawnScenario.locked) implies
    (SpawnScenario.outcome = spawnStarted and SpawnScenario.spawn = spawnCells)
}

check ClearSpawnStartsGame for exactly 16 Cell, exactly 4 Column, exactly 4 Row, 1 steps

assert BlockedSpawnGameOver {
  some (SpawnScenario.spawn & SpawnScenario.locked) implies SpawnScenario.outcome = spawnGameOver
}

check BlockedSpawnGameOver for exactly 16 Cell, exactly 4 Column, exactly 4 Row, 1 steps

assert SpawnAvailabilityRefinesCoordinates {
  (SpawnScenario.availability = spawnOpen) iff no (SpawnScenario.spawn & SpawnScenario.locked)
}

check SpawnAvailabilityRefinesCoordinates for exactly 16 Cell, exactly 4 Column, exactly 4 Row, 1 steps
