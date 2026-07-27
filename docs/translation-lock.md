# Reviewed Translation Lock

`dspec translation` treats a translation as a reviewed binding from the model's
`primaryLocale` text to a target `LocalizedText.labels[locale]` value. It does
not create translations or claim that two natural-language sentences have the
same meaning.

The source language is `model.primaryLocale`. Target languages are
`i18n.requiredLocales` excluding that source; if no required locales are
declared, all declared non-primary locales are targets.

```pkl
model: d.Model = new {
  primaryLocale = "ja"
  locales { "ja"; "en" }
  i18n = new d.I18nContract {
    requiredLocales { "ja"; "en" }
  }
  rules {
    new d.Rule {
      id = "PASSWORD-MIN-LENGTH"
      text = d.text(
        "8文字未満のパスワードを拒否する",
        "Reject passwords shorter than eight characters",
      )
    }
  }
}
```

After a human has reviewed the translated model, freeze its bindings:

```sh
dspec translation reconcile specs/password.pkl
# writes specs/password.translation.lock.json
```

CI and hooks then check that the reviewed pairing is still current:

```sh
dspec translation check --gate specs/password.pkl
```

## What it decides

The lock contains one binding per localizable field and target locale, with a
hash of the source text and target text. It also locks the declared `i18n`
glossary. The deterministic checker reports:

- `source-content`: the source wording changed, so the prior translation review
  is stale;
- `translation-content`: the target wording changed and needs review;
- `translation-linked` / `translation-unlinked`: a locale binding was added or
  removed; and
- `terminology-content`: the glossary changed.

Missing labels for a selected target locale are errors. This complements
`dspec check`, which validates required labels and glossary-term consistency.

## Explicit boundary

Passing means that the exact source/target text pairing and glossary are the
ones reviewers accepted. It does **not** prove semantic equivalence, fluency,
or locale appropriateness. An LLM or translation-memory system can propose a
translation, but its output remains a candidate until a reviewer accepts it by
updating the model and reconciling the lock. Domain examples, terminology QA,
and human review remain the decision authority for meaning.

For dspec itself, `pkf run translation:verify` gates
[`examples/dspec.translation.lock.json`](../examples/dspec.translation.lock.json).
