export function approveRequest(input) {
  return {
    approval_id: `wrong-${input.request_id}`,
    notified: false,
  };
}
