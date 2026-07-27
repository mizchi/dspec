export async function approveRequestTransaction(input, transaction) {
  transaction.read("requests");
  transaction.write("requests");
  transaction.effect("request.approved.notification", {
    approval_id: `approval-${input.request_id}`,
  });
  transaction.commit();
  return {
    approval_id: `approval-${input.request_id}`,
    notified: true,
  };
}
