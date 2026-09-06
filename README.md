# git-log-lint

`git log`'s default output is meant for a human to eyeball in a terminal. As
soon as you try to script against it - pipe it into another tool, diff two
runs, check that a hook produced sane data - you hit the usual problems:
subjects can contain almost any character, author names can have spaces or
commas, dates come in whatever format `--date` was set to, and there's no
reliable record separator. Every ad hoc awk/sed pipeline that reads `git log`
output eventually breaks on some commit message.

git-log-lint fixes the input side of that problem by asking git to emit a
strict, delimited format, then parsing it with real validation - malformed
hashes, bad dates, and missing fields are rejected with a specific error
instead of silently producing garbage. The output side is a plain text pretty
printer, useful on its own or as a template for something more specific
(HTML report, changelog, etc).

## Usage

Generate input with a fixed format string. `%x1f` and `%x1e` are the field
and record separators git-log-lint expects:

```sh
git log --format='%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%s%x1e' > history.log
```

Then either pipe it in:

```sh
git log --format='%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%s%x1e' | node dist/cli.js
```

or read it from a file (or several - they're concatenated):

```sh
node dist/cli.js history.log
```

Sample output:

```
a1b2c3d  fix off-by-one in wrap()
         Jane Doe <jane@example.com>  2026-03-01 10:22Z

9f8e7d6  merge branch 'feature/parser'
         Jane Doe <jane@example.com>  2026-03-02 09:05Z  (merge of 2)
```

A malformed record fails loudly instead of printing something plausible-
looking but wrong:

```
git-log-lint: record 3: "not-a-hash" is not a 40-character lowercase hex commit hash
```

Pass `--json` to get the parsed records as JSON instead of the pretty-printed
text - useful for piping into another script:

```sh
node dist/cli.js --json history.log
```

```json
[
  {
    "hash": "a1b2c3d4e5f6789012345678901234567890abcd",
    "abbrevHash": "a1b2c3d",
    "authorName": "Jane Doe",
    "authorEmail": "jane@example.com",
    "date": "2026-03-01T10:22:00.000Z",
    "parents": [],
    "subject": "fix off-by-one in wrap()"
  }
]
```

## Building

There's no build step checked in. With TypeScript installed:

```sh
tsc
node dist/cli.js history.log
```

## Testing

Tests use `node:test` and `node:assert`, both in the standard library - no test
runner dependency. They compile alongside the rest of the source, so run them
with:

```sh
npm test
```

which is shorthand for `tsc && node --test dist/*.test.js`.

## Format

Each record has exactly seven fields, in this order: full hash, abbreviated
hash, author name, author email, author date (any format `Date` can parse -
`--date=iso-strict` is recommended), space-separated parent hashes (empty for
the root commit), subject line.

## Status

Early skeleton. Parses and pretty-prints, with unit tests covering the
parser's validation rules. See the roadmap in the commit history for what's
planned next.
