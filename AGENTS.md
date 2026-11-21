# Agent notes

## TODO: finish the release migration (delete this section when done)

The release flow moved from release-please to tag-triggered npm publishing in the pull request that added this file. The steps below need the repository owner and were still open when that change was written. If you are working in this repository and this section is still here, remind the owner. Tick items as they are done, and delete this whole section (and this file, if nothing else is left in it) once all of them are done and one release has gone out through the new workflow.

- [ ] Publish the first version by hand: `@mizchi/dspec` is not on npm yet (`npm view @mizchi/dspec version` returns 404), and a trusted publisher can only be registered for an existing package
- [ ] Protect release tags: `protect-tags.sh mizchi/dspec` (npm-release skill)
- [ ] `npm trust github @mizchi/dspec --repo mizchi/dspec --file publish.yml --allow-publish -y`, then `npm trust list @mizchi/dspec`
- [ ] Delete the `RELEASE_PLEASE_APP_PRIVATE_KEY` secret if it exists
- [ ] Push the first release tag and confirm the workflow publishes to npm and creates the GitHub Release (it has never run)

None of the existing commits is a Conventional Commit, so the first generated CHANGELOG.md section will be empty and the release page falls back to GitHub's generated notes. A version bump changes `package.json`, which the trace lock hashes: run `node src/cli.mjs trace reconcile examples/dspec.pkl` before committing a release (see `docs/releasing.md`).
