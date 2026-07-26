/// Pure adapter for the intentionally small gravity-to-lock behavior model.
/// It is not a full Tetris implementation.
export function gravity({ state }) {
  if (state["piece-present"] !== 1 || state["drop-distance"] < 1) {
    return { status: "rejected", state: { ...state } };
  }
  return {
    status: "accepted",
    state: { ...state, "drop-distance": state["drop-distance"] - 1 },
  };
}

export function lock({ state }) {
  if (state["piece-present"] !== 1 || state["drop-distance"] !== 0) {
    return { status: "rejected", state: { ...state } };
  }
  return {
    status: "accepted",
    state: {
      ...state,
      "piece-present": 0,
      "locked-piece-count": state["locked-piece-count"] + 1,
    },
  };
}
