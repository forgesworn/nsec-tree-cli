# JSON Schemas

This document describes the stable JSON output shapes currently emitted by
`nsec-tree-cli` when `--json` is used.

These are practical schemas intended for scripting with tools like `jq`.

## `root create`

```json
{
  "rootType": "mnemonic-backed",
  "recoverable": true,
  "masterNpub": "npub1...",
  "mnemonic": "abandon ... about",
  "profile": "optional-profile-name"
}
```

## `root restore` / `root import-nsec` / `root inspect`

```json
{
  "rootType": "mnemonic-backed | nsec-backed",
  "recoverable": true,
  "masterNpub": "npub1...",
  "profile": "optional-profile-name",
  "source": "optional-source-description"
}
```

## `derive path`

```json
{
  "rootType": "mnemonic-backed | nsec-backed",
  "recoverable": true,
  "path": "personal@0/forum-burner@0",
  "segments": [
    {
      "name": "personal",
      "requestedIndex": 0,
      "actualIndex": 0,
      "npub": "npub1..."
    }
  ],
  "npub": "npub1...",
  "publicKey": "hex",
  "purpose": "forum-burner",
  "index": 0,
  "secretRequested": false,
  "profile": "optional-profile-name"
}
```

## `export npub`

```json
{
  "path": "personal@0",
  "npub": "npub1..."
}
```

## `export nsec`

```json
{
  "path": "personal@0",
  "nsec": "nsec1..."
}
```

## `export identity`

```json
{
  "path": "personal@0/forum-burner@0",
  "segments": [],
  "npub": "npub1...",
  "nsec": "nsec1...",
  "publicKey": "hex",
  "purpose": "forum-burner",
  "index": 0
}
```

## `prove private` / `prove full`

The CLI emits the proof object from `nsec-tree` directly:

```json
{
  "masterPubkey": "hex",
  "childPubkey": "hex",
  "purpose": "optional-purpose",
  "index": 0,
  "attestation": "string",
  "signature": "hex"
}
```

## `verify proof`

```json
{
  "valid": true,
  "proofType": "private | full",
  "proof": {
    "masterPubkey": "hex",
    "childPubkey": "hex",
    "purpose": "optional-purpose",
    "index": 0,
    "attestation": "string",
    "signature": "hex"
  }
}
```

## `shamir split`

```json
{
  "rootType": "mnemonic-backed",
  "recoverable": true,
  "shares": [
    {
      "index": 1,
      "threshold": 2,
      "words": ["abandon", "ability"],
      "phrase": "abandon ability ..."
    }
  ]
}
```

## `shamir recover`

```json
{
  "rootType": "mnemonic-backed",
  "recoverable": true,
  "mnemonic": "abandon ... about"
}
```

## `profile list`

```json
[
  {
    "name": "personal",
    "savedAt": "2026-03-19T00:00:00.000Z",
    "rootType": "mnemonic-backed",
    "recoverable": true,
    "masterNpub": "npub1...",
    "active": true
  }
]
```

## `profile show`

The CLI emits the stored profile record:

```json
{
  "name": "personal",
  "savedAt": "2026-03-19T00:00:00.000Z",
  "rootType": "mnemonic-backed",
  "recoverable": true,
  "masterNpub": "npub1...",
  "root": {
    "type": "mnemonic-backed",
    "mnemonic": "abandon ... about",
    "passphrase": "optional"
  }
}
```

## `inspect path`

```json
{
  "path": "personal@0/forum-burner@0",
  "segments": [
    {
      "name": "personal",
      "requestedIndex": 0
    }
  ],
  "deterministic": true
}
```
