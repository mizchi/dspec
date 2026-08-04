# Traceability tetris-baseline

- status: `pass`
- formalizations: `11` (passed: `11`)
- refinements: `1/1` substantiated
- rules: `9/9` covered (excluded: `1`)
- commands: `5/5` grounded
- events: `6/6` grounded

## Refinements

### spawn-open-from-coordinates

- kind: `input-abstraction`; evidence: `pass`
- abstract: `start-game-behavior` — spawn-open = 1
- concrete: `coordinate-start-spawn-alloy` — no (SpawnScenario.spawn & SpawnScenario.locked)
- state relation: spawn-open is 1 exactly when the fixed spawn footprint has no locked coordinate
- preserves rule: `TETRIS-START-GAME`
- assumption: The correspondence is checked for one locked cell and the fixed north-facing T spawn footprint on the finite 4 by 4 board.
- assumption: It identifies the abstract input only; random tetromino selection and production board size remain outside this refinement.
- check: `tetris.coordinate-spawn.availability-refines-coordinates.holds` — `pass` (bounded-relational-reference)
- check: `tetris.coordinate-spawn.implementation-input-conforms.holds` — `pass` (finite-coordinate-conformance)

## Formalizations

### board-bounds-alloy

- rule: `TETRIS-BOARD-BOUNDS` — 固定済みセルと操作中ピースの各セルは、幅 10・高さ 20 の盤面内にある
- kind: `alloy-behavior`; assurance: `bounded`
- target: `model fixtures/tetris-alloy.pkl`
- evidence: `pass`
- formal tool: `alloy6` — `not-requested`
- assumption: The relational board is a finite 4 by 4 scope selected for counterexample search, not the production 10 by 20 board.
- assumption: Cells have explicit row and column coordinates; SRS kicks remain outside this model.
- mapping: rotate → command: rotate-active-piece → event: active-piece-rotated (`grounded`)
- check: `tetris.board.bounds.holds` — `pass` (bounded-relational-reference)

### coordinate-blocked-spawn-alloy

- rule: `TETRIS-SPAWN-GAME-OVER` — 新しいピースの出現位置が固定済みセルと重なるなら、ゲームはゲームオーバーになる
- kind: `alloy-behavior`; assurance: `bounded`
- target: `model fixtures/tetris-alloy.pkl`
- evidence: `pass`
- formal tool: `alloy6` — `not-requested`
- assumption: The coordinate model uses the same finite T spawn footprint as coordinate-start-spawn-alloy.
- assumption: A blocked spawn is modeled as an automatic post-gameplay transition, not as a rejected start-game command.
- mapping: blockedSpawnGameOver → event: game-over (`grounded`)
- check: `tetris.coordinate-spawn.blocked-game-over.holds` — `pass` (bounded-relational-reference)

### coordinate-start-spawn-alloy

- rule: `TETRIS-START-GAME` — 出現位置が空いているなら、ゲーム開始時に操作中のピースを 1 つ出現させる
- kind: `alloy-behavior`; assurance: `bounded`
- target: `model fixtures/tetris-alloy.pkl`
- evidence: `pass`
- formal tool: `alloy6` — `not-requested`
- assumption: The coordinate model fixes a north-facing T tetromino spawn footprint at (0,2), (1,2), (2,2), and (1,3) on a 4 by 4 board.
- assumption: It enumerates all 16 positions of exactly one locked cell; production board size and random tetromino selection remain outside this scope.
- mapping: startGameAtSpawn → command: start-game → event: game-started (`grounded`)
- check: `tetris.coordinate-spawn.availability-refines-coordinates.holds` — `pass` (bounded-relational-reference)
- check: `tetris.coordinate-spawn.clear-starts-game.holds` — `pass` (bounded-relational-reference)
- check: `tetris.coordinate-spawn.implementation-input-conforms.holds` — `pass` (finite-coordinate-conformance)

### gravity-lock-behavior

- rule: `TETRIS-GRAVITY-LOCKS` — 重力で下降できないピースは固定される
- kind: `behavior`; assurance: `bounded`
- target: `model fixtures/tetris-gravity-behavior.pkl`
- evidence: `pass`
- assumption: This bounded model abstracts the board to remaining drop distance.
- assumption: The model represents locking as an explicit transition immediately after a failed downward move; it does not yet encode an automatic gravity scheduler.
- mapping: gravity → command: tick-gravity → event: active-piece-translated (`grounded`)
- mapping: lock → event: piece-locked (`grounded`)
- check: `tetris.at-most-one-active-piece-always` — `pass` (bounded-all-paths)
- check: `tetris.gravity-path-eventually-locks` — `pass` (finite-scheduled-trace)
- check: `tetris.lock.reachable` — `pass` (bounded)

### line-clear-alloy

- rule: `TETRIS-CLEAR-FULL-ROWS` — ピース固定後、すべての列が埋まった行を消去し、その上の固定済みセルを同じ行数だけ下げる
- kind: `alloy-behavior`; assurance: `bounded`
- target: `model fixtures/tetris-line-clear-alloy.pkl`
- evidence: `pass`
- formal tool: `alloy6` — `not-requested`
- assumption: The model enumerates every locked-cell subset of a 4 by 4 board; it does not model score calculation or simultaneous spawn behavior.
- assumption: Row 0 is the bottom; cells above cleared rows fall by the number of cleared rows below them.
- mapping: clearFullRows → event: lines-cleared (`grounded`)
- check: `tetris.full-row.clear-and-compact.holds` — `pass` (bounded-relational-reference)

### no-overlap-alloy

- rule: `TETRIS-NO-OVERLAP` — 操作中ピースのセルは固定済みセルと重ならず、同じセルを二重に占有しない
- kind: `alloy-behavior`; assurance: `bounded`
- target: `model fixtures/tetris-alloy.pkl`
- evidence: `pass`
- formal tool: `alloy6` — `not-requested`
- assumption: The relational model represents active and locked occupancy as sets, so duplicate cell identity is impossible by construction.
- mapping: rotate → command: rotate-active-piece → event: active-piece-rotated (`grounded`)
- check: `tetris.board.disjoint.holds` — `pass` (bounded-relational-reference)

### rotation-rejection-alloy

- rule: `TETRIS-LEGAL-ROTATION` — 回転後のピースが盤面外または固定済みセルと衝突するなら、その回転は拒否され状態を変えない
- kind: `alloy-behavior`; assurance: `bounded`
- target: `model fixtures/tetris-alloy.pkl`
- evidence: `pass`
- formal tool: `alloy6` — `not-requested`
- assumption: The model checks clockwise geometric rotation of a T tetromino around its pivot; SRS kick offsets remain outside this model.
- mapping: rejectRotation → command: rotate-active-piece → event: active-piece-rotated (`grounded`)
- check: `tetris.rotation.collision-rejected.holds` — `pass` (bounded-relational-reference)

### spawn-game-over-behavior

- rule: `TETRIS-SPAWN-GAME-OVER` — 新しいピースの出現位置が固定済みセルと重なるなら、ゲームはゲームオーバーになる
- kind: `behavior`; assurance: `bounded`
- target: `model fixtures/tetris-spawn-game-over-behavior.pkl`
- evidence: `pass`
- assumption: The behavior action spawnBlocked represents a later spawn-footprint collision after gameplay; it is an automatic transition rather than the start-game command.
- assumption: The footprint calculation is not yet connected to the coordinate board model.
- assumption: The coordinate-level counterpart is checked by coordinate-blocked-spawn-alloy.
- mapping: spawnBlocked → event: game-over (`grounded`)
- check: `tetris.spawn-collision.eventually-game-over` — `pass` (finite-trace)
- check: `tetris.spawn-collision.game-over.reachable` — `pass` (bounded)

### start-game-behavior

- rule: `TETRIS-START-GAME` — 出現位置が空いているなら、ゲーム開始時に操作中のピースを 1 つ出現させる
- kind: `behavior`; assurance: `bounded`
- target: `model fixtures/tetris-start-game-behavior.pkl`
- evidence: `pass`
- assumption: The model abstracts a clear spawn footprint as the input spawn-open = 1; tetromino choice and coordinates are not selected yet.
- assumption: game-exists = 0 denotes the pre-command state, while game-status = 0 denotes the playing status after a successful start.
- assumption: The coordinate-level counterpart is checked by coordinate-start-spawn-alloy.
- mapping: startGame → command: start-game → event: game-started (`grounded`)
- check: `tetris.start-game.eventually-started` — `pass` (finite-trace)
- check: `tetris.start-game.started.reachable` — `pass` (bounded)

### terminal-game-over-behavior

- rule: `TETRIS-TERMINAL-GAME-OVER` — ゲームオーバー後には移動、回転、重力落下、固定を受理しない
- kind: `behavior`; assurance: `bounded`
- target: `model fixtures/tetris-terminal-game-over-behavior.pkl`
- evidence: `pass`
- assumption: This bounded model starts from game over and verifies that its four declared gameplay actions are rejected.
- mapping: gravity → command: tick-gravity (`grounded`)
- mapping: lock → command: hard-drop-active-piece → event: piece-locked (`grounded`)
- mapping: rotate → command: rotate-active-piece (`grounded`)
- mapping: translate → command: translate-active-piece (`grounded`)
- check: `tetris.game-over.always-terminal` — `pass` (bounded-all-paths)
- check: `tetris.game-over.playing.unreachable` — `pass` (bounded)

### translation-rejection-alloy

- rule: `TETRIS-LEGAL-TRANSLATION` — 移動後のピースが盤面外または固定済みセルと衝突するなら、その移動は拒否され状態を変えない
- kind: `alloy-behavior`; assurance: `bounded`
- target: `model fixtures/tetris-alloy.pkl`
- evidence: `pass`
- formal tool: `alloy6` — `not-requested`
- assumption: The bounded board checks one-cell movement to the left; the other translation directions are symmetric but are not yet enumerated.
- assumption: The T tetromino is represented by four explicit coordinates around a pivot.
- mapping: rejectTranslateLeft → command: translate-active-piece → event: active-piece-translated (`grounded`)
- check: `tetris.translation.illegal-rejected.holds` — `pass` (bounded-relational-reference)
