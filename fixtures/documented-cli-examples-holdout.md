# Documented CLI Example Holdout

This fixture is intentionally shaped differently from README prose so the
extractor is not only tuned to the current docs.

```sh
node src/cli.mjs drift --json examples/dspec.pkl
node src/cli.mjs emit runtime-collector-fixture fixtures/runtime-model.pkl \
  | node $OLDPWD/src/cli.mjs verify-runtime-evidence --json /dev/stdin
dspec check examples/dspec.pkl
```

Inline examples should also be recognized: `dspec coverage --json examples/dspec.pkl`.

Grouped spec-change examples may be written without the node prefix:
`spec-change compat --json fixtures/compat-before.pkl fixtures/compat-narrowing-after.pkl`.
