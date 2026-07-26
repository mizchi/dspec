function rejected(state) {
  return { status: "rejected", state };
}

/**
 * Pure coordinate adapter for the fixed north-facing T spawn used by the
 * bounded 4 by 4 model. It owns the footprint calculation rather than taking
 * the reference model's footprint as input.
 */
export function spawnAvailability({ board, locked }) {
  const pivot = [1, board.height - 2];
  const spawn = [[-1, 0], [0, 0], [1, 0], [0, 1]]
    .map(([offsetX, offsetY]) => [pivot[0] + offsetX, pivot[1] + offsetY]);
  const occupied = new Set(locked.map(([x, y]) => `${x},${y}`));
  return { spawnOpen: spawn.some(([x, y]) => occupied.has(`${x},${y}`)) ? 0 : 1 };
}

export function brokenSpawnAvailability() {
  return { spawnOpen: 1 };
}

export function startGame({ state, input }) {
  if (state["game-exists"] !== 0 || input["spawn-open"] !== 1) return rejected(state);
  return {
    status: "accepted",
    state: {
      ...state,
      "game-exists": 1,
      "game-status": 0,
      "active-piece-count": 1,
    },
  };
}

export function spawnBlocked({ state }) {
  if (state["game-status"] !== 0) return rejected(state);
  return {
    status: "accepted",
    state: { ...state, "game-status": 1 },
  };
}

export function translate({ state }) {
  return rejected(state);
}

export function rotate({ state }) {
  return rejected(state);
}

export function gravity({ state }) {
  return rejected(state);
}

export function lock({ state }) {
  return rejected(state);
}
