# TODO

## Near term

- polish help output with short examples
- document stable JSON output per command
- add more tests around error cases
- add tests for `root inspect`, `inspect root`, and profile removal
- document environment variable support

## UX polish

- suggest likely fixes in common error paths
- improve human output for `prove` and `verify`
- add a short explanation block for root type in `root inspect`
- make secret-emitting output more obviously labeled
- consider `--no-warn` for non-interactive scripting

## Profiles

- add profile metadata / notes
- add explicit profile export/import format
- consider profile namespaces or environments
- add “show active profile” shortcut

## Recovery

- document the exact `shamir-words` share format used here
- add examples for paper/offline storage practices
- consider optional grouped share file output
- add recovery workflow docs for real-world use

## Documentation

- add a “Which root should I choose?” page
- add dev-group and privacy-group post drafts
- add a comparison doc vs raw `nsec` workflows
- add “why existing Nostr approaches are different” doc

## Release prep

- add license and release checklist review
- decide package publishing strategy
- add changelog strategy
- add GitHub Actions for tests
