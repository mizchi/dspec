module tetris_line_clear_alloy_v1

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

enum LastAction { idleAction, clearAction }

one sig Game {
  var locked: set Cell,
  var priorLocked: set Cell,
  var clearedRows: set Row,
  var action: one LastAction
}

fact Geometry {
  #Column = 4
  #Row = 4
  #Board.cells = 16
  Board.cells = Cell
  all disj left, right: Cell | left.column != right.column or left.row != right.row
}

fun rowCells[r: set Row]: set Cell { r.~row }
fun fullRows[cells: set Cell]: set Row { { r: Row | rowCells[r] in cells } }
fun fullRowCells[cells: set Cell]: set Cell { rowCells[fullRows[cells]] }
fun compacted[cells: set Cell]: set Cell {
  { target: Cell | some source: cells - fullRowCells[cells] |
    target.column = source.column and
    #((row/prevs[source.row]) - fullRows[cells]) = #(row/prevs[target.row])
  }
}

fact Initial {
  some fullRows[Game.locked]
  Game.priorLocked = Game.locked
  no Game.clearedRows
  Game.action = idleAction
}

pred clearFullRows {
  some fullRows[Game.locked]
  Game.priorLocked' = Game.locked
  Game.clearedRows' = fullRows[Game.locked]
  Game.locked' = compacted[Game.locked]
  Game.action' = clearAction
}

pred stutter {
  Game.priorLocked' = Game.locked
  no Game.clearedRows'
  Game.locked' = Game.locked
  Game.action' = idleAction
}

fact Transitions {
  always (clearFullRows or stutter)
}

assert FullRowsClearAndCompact {
  always (Game.action = clearAction implies
    (Game.clearedRows = fullRows[Game.priorLocked] and Game.locked = compacted[Game.priorLocked]))
}

check FullRowsClearAndCompact for exactly 16 Cell, exactly 4 Column, exactly 4 Row, 2 steps
