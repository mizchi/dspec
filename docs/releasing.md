# Releasing

Pushing a `v<version>` tag publishes that version. `.github/workflows/publish.yml`
checks that the tag equals the `package.json` version, runs the gates, publishes
to npm through an OIDC Trusted Publisher, and creates the GitHub release.

## One-time setup

1. Ensure `@mizchi/dspec` exists on npm. A Trusted Publisher can only be
   registered for an existing package, so the first version is published by
   hand: `npm login --auth-type=web && npm publish`.
2. Register the Trusted Publisher. npm binds it to the workflow filename, so
   renaming `publish.yml` requires registering again:

   ```sh
   npm trust github @mizchi/dspec --repo mizchi/dspec --file publish.yml --allow-publish -y
   npm trust list @mizchi/dspec
   ```

   This needs npm 11.15+, 2FA on the npm account, and a terminal with a TTY.
3. Restrict creating, moving, and deleting `v*` tags to repository admins with
   a tag ruleset. Whoever can push a `v*` tag can publish.

The publish job uses a GitHub-hosted runner, Node 24, npm 11+, and OIDC. It does
not require a long-lived npm write credential or any repository secret. npm
attaches provenance for a public package published from this public repository.

## Release procedure

1. Merge Conventional Commit changes to `main`. Only `feat`, `fix`, `perf`,
   `revert`, and `docs` commits appear in the changelog.
2. Run `pkf run --refresh check:fast` and
   `nix develop path:$PWD -c pkf run --refresh check:formal`. The fast gate
   includes type checking, checker conformance fixtures, and a clean package
   installation that imports the bundled Pkl schema, runs `dspec verify`, and
   builds the Pkl ZIP through its facade API test.
3. Bump the version, generate the changelog, and commit. The package starts at
   `0.0.0`; the first feature release is `0.1.0`.

   ```sh
   npm version <version> --no-git-tag-version
   GITHUB_TOKEN=$(gh auth token) npx -y git-cliff@2.14.2 --tag v<version> -o CHANGELOG.md
   node src/cli.mjs trace reconcile examples/dspec.pkl
   git commit -am "chore: release <version>"
   ```

   `CHANGELOG.md` is generated from `cliff.toml`; review it against the diff
   instead of editing it by hand. `GITHUB_TOKEN` lets git-cliff look up pull
   requests and credit outside contributors; `--offline` skips that lookup.
   The trace lock records the hash of `package.json`, so it is reconciled in
   the same commit.
4. Tag the release commit and push the branch and the tag together:

   ```sh
   git tag v<version>
   git push origin main v<version>
   gh run watch
   ```

5. `publish.yml` then fails early when the tag and the `package.json` version
   differ, runs type checking, tests, and the clean package smoke, creates the
   Pkl metadata/ZIP/checksum artifacts, uploads them to the fixed `pkl`
   package-index release (so the Pkl package URI can retrieve versioned
   metadata), publishes through the Trusted Publisher, and creates the GitHub
   release for the tag from the matching `CHANGELOG.md` section. When that
   section is missing or empty, GitHub generates the notes.
6. Verify the published version and provenance with `npm view @mizchi/dspec`.
   The registry can lag about a minute behind a successful workflow.

A version containing `-`, such as `0.2.0-rc.0` with the tag `v0.2.0-rc.0`,
publishes under the npm dist-tag `next` and creates a GitHub pre-release.

If the workflow fails before `npm publish`, fix the cause, delete the tag
(`git tag -d v<version> && git push origin :v<version>`), and tag again. A
version that reached npm cannot be published again; release the next patch.
