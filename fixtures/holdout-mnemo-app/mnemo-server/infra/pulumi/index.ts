import * as cloudflare from "@pulumi/cloudflare";

const serviceToken = new cloudflare.ZeroTrustAccessServiceToken("mnemo-cli-service-token", {
  accountId: "ACCOUNT_ID",
  name: "mnemo CLI",
});

const application = new cloudflare.ZeroTrustAccessApplication("mnemo-v1-api", {
  accountId: "ACCOUNT_ID",
  name: "mnemo /v1 API",
  domain: "mnemo.example.test/v1/*",
});

const platformDb = new cloudflare.D1Database("mnemo-platform-db", {
  accountId: "ACCOUNT_ID",
  name: "mnemo-platform-staging",
});

const platformShard00 = new cloudflare.D1Database("mnemo-platform-shard-00-db", {
  accountId: "ACCOUNT_ID",
  name: "mnemo-platform-shard-00-staging",
});

const skillAssets = new cloudflare.R2Bucket("mnemo-skill-assets-bucket", {
  accountId: "ACCOUNT_ID",
  name: "mnemo-skill-assets-staging",
});

export { application, platformDb, platformShard00, serviceToken, skillAssets };
