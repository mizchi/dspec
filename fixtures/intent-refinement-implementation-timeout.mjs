export function approveRequest() {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, 1000);
  return { approval_id: "approval-request-001", notified: true };
}
