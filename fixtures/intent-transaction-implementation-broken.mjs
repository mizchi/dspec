export async function approveRequestTransaction(input, transaction) {
  transaction.read("requests");
  transaction.write("approvals");
  transaction.commit();
  return {
    approval_id: `approval-${input.request_id}`,
    notified: true,
  };
}
