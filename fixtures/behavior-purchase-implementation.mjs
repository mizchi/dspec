/// Implementation adapter contract used by the behavior-grounding fixture.
/// A real adapter may translate this interface to an application service,
/// HTTP endpoint, transaction, or pure domain function.
export function purchase({ state, input }) {
  if (input.quantity > state.available) {
    return { status: "rejected", state: { ...state } };
  }
  return {
    status: "accepted",
    state: { available: state.available - input.quantity },
  };
}

/// Deliberately wrong: used only to prove the grounding check is load-bearing.
export function brokenPurchase({ state }) {
  return { status: "accepted", state: { ...state } };
}
