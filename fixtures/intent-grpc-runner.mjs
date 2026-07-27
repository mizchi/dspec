let raw = "";
for await (const chunk of process.stdin) raw += chunk;

const request = JSON.parse(raw);
if (request.protocol !== "dspec-grpc-runner-v1") {
  process.stderr.write("unsupported runner protocol\n");
  process.exitCode = 2;
} else if (request.method !== "/approval.v1.RequestService/Approve") {
  process.stdout.write(JSON.stringify({ code: "UNIMPLEMENTED", output: null }));
} else {
  process.stdout.write(JSON.stringify({
    code: "OK",
    output: {
      approval_id: `approval-${request.input.request_id}`,
      notified: true,
    },
  }));
}
