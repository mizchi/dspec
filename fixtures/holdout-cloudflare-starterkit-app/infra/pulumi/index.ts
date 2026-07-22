import * as cloudflare from "@pulumi/cloudflare";

const serviceToken = new cloudflare.ZeroTrustAccessServiceToken("app-cli-service-token", {});
const application = new cloudflare.ZeroTrustAccessApplication("app-access", {});
const appDb = new cloudflare.D1Database("app-db", {});
const assetsBucket = new cloudflare.R2Bucket("app-assets-bucket", {});
