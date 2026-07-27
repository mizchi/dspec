export function approveRequest(input) {
  if (input.amount_cents < 1) return { reason: "not-manager" };
  return {
    approval_id: `approval-${input.request_id}`,
    notified: input.notify ?? true,
  };
}
