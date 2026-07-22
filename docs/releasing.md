# Releasing

## One-time setup

1. Ensure `@mizchi/dspec` exists on npm. The first package-name reservation may
   require one manual publish before npm allows a Trusted Publisher to be
   configured.
2. Add a GitHub Actions Trusted Publisher in the npm package settings:
   owner `mizchi`, repository `dspec`, workflow filename `publish.yml`, allowed
   action `npm publish`.
3. Install the release-please GitHub App and store its PEM as the repository
   secret `RELEASE_PLEASE_APP_PRIVATE_KEY`.

The publish job uses a GitHub-hosted runner, Node 24, npm 11+, and OIDC. It does
not require a long-lived npm write credential. npm attaches provenance for a
public package published from this public repository.

## Release procedure

1. Merge Conventional Commit changes to `main`.
2. Run `gh workflow run release-please.yml --repo mizchi/dspec`.
3. Review and merge the generated release PR. For the first feature release,
   the manifest starts at `0.0.0` and the release PR advances it to `0.1.0`.
4. Before merging, run `pkf run --refresh check:fast` and
   `nix develop path:$PWD -c pkf run --refresh check:formal`. The fast gate
   includes type checking, checker conformance fixtures, and a clean package
   installation that imports the bundled Pkl schema, runs `dspec verify`, and
   builds the Pkl ZIP through its facade API test.
5. The merge creates a GitHub release; `publish.yml` then runs type checking,
   tests, the clean package smoke, creates the Pkl metadata/ZIP/checksum
   artifacts, uploads them to the fixed `pkl` package-index release (so the
   Pkl package URI can retrieve versioned metadata), and publishes through the
   Trusted Publisher.
6. Verify the published version and provenance with `npm view @mizchi/dspec`.

`CHANGELOG.md`, package version, and `.release-please-manifest.json` are managed
by release-please after bootstrap.
