export const TOPIC_NAMES = ['model', 'proofs', 'recovery', 'paths', 'offline']

function explainModel(fmt) {
  const { c, section, boxHeader, nextSteps } = fmt
  return section([
    boxHeader('What is nsec-tree?'),
    '',
    `  ${c.bold}One root. Unlimited identities.${c.reset}`,
    '',
    '  nsec-tree derives as many distinct Nostr keypairs as you need',
    '  from a single root secret. Each derived identity is fully',
    '  independent — different keys, different npubs — yet all flow',
    '  from the same source.',
    '',
    `  ${c.dim}Analogy:${c.reset} think of a locksmith's master key. From one blank`,
    '  you can cut unlimited unique keys, each opening a different',
    '  door. The keys share no obvious relationship, but you hold',
    '  the master.',
    '',
    `  ${c.bold}Two root types:${c.reset}`,
    '',
    `  ${c.cyan}Mnemonic-backed${c.reset}  Derived from a BIP-39 phrase (12 or 24 words).`,
    '                  Best for long-term use. Recoverable from',
    '                  your word list if you lose the root file.',
    '',
    `  ${c.cyan}nsec-backed${c.reset}      Derived from an existing nsec you already hold.`,
    '                  Useful if you have a Nostr identity and want',
    '                  to branch identities from it. Not recoverable',
    '                  via phrase — protect the nsec itself.',
    '',
    '  Both types produce identical derived identities for the same',
    '  path. The difference is only in how you back up and recover',
    '  the root.',
    '',
    nextSteps([
      'nsec-tree root create',
      'nsec-tree explain recovery',
    ]),
  ])
}

function explainProofs(fmt) {
  const { c, section, boxHeader, nextSteps } = fmt
  return section([
    boxHeader('Why prove two identities share a root?'),
    '',
    '  Sometimes you want to demonstrate a relationship between two',
    '  of your Nostr identities — without giving away your root or',
    '  your full identity graph.',
    '',
    `  ${c.bold}Real-world use cases:${c.reset}`,
    '',
    `  ${c.cyan}Bootstrapping trust${c.reset}  Link a new bot or project account to`,
    '                       your main reputation so followers',
    '                       know it is officially yours.',
    `  ${c.cyan}Secure key rotation${c.reset}  If your mobile key is compromised, derive`,
    '                       a new one and prove it is the official',
    '                       replacement using your offline root.',
    `  ${c.cyan}De-anonymization${c.reset}     Run a burner account perfectly anonymously,`,
    '                       then cryptographically prove it was you',
    '                       later when you want to take credit.',
    `  ${c.cyan}Corporate identity${c.reset}   A master company root delegates to`,
    '                       @marketing and @support, proving',
    '                       official affiliation without sharing keys.',
    '',
    `  ${c.bold}Two proof types:${c.reset}`,
    '',
    `  ${c.cyan}Private proof${c.reset}        Demonstrates that both identities descend from`,
    '                       the same root, without revealing which path',
    '                       each one sits on. Anyone verifying the proof',
    '                       learns only: "these two belong to the same',
    '                       person." Nothing more.',
    '',
    `  ${c.dim}Analogy:${c.reset} like showing two passports with the same photo`,
    "  but different names — the verifier confirms it's you,",
    '  but learns nothing about your other documents.',
    '',
    `  ${c.cyan}Full proof${c.reset}           Reveals both identities and their exact paths.`,
    '                       Use this when you actively want to publish',
    '                       that link — for example, migrating publicly',
    '                       from an old identity to a new one.',
    '',
    `  ${c.bold}Proofs are optional and selective.${c.reset}`,
    '',
    '  Most identities you derive will never need a proof. You',
    '  choose, per pair, whether to reveal any connection at all.',
    '  Unlinked identities remain unlinked until you decide otherwise.',
    '',
    nextSteps([
      'nsec-tree prove private personal',
      'nsec-tree prove full personal',
    ]),
  ])
}

function explainRecovery(fmt) {
  const { c, section, boxHeader, nextSteps } = fmt
  return section([
    boxHeader('What happens if you lose your root?'),
    '',
    '  Your root is the single point of trust for all derived',
    '  identities. Lose it without a backup, and you lose access',
    '  to every identity derived from it.',
    '',
    `  ${c.bold}Phrase backup (mnemonic-backed roots only)${c.reset}`,
    '',
    '  If you created your root from a BIP-39 phrase, you can',
    '  recreate the root at any time by re-entering those words.',
    '  Write them down. Store them somewhere safe and separate',
    '  from your device.',
    '',
    `  ${c.bold}Shamir splitting${c.reset}`,
    '',
    '  For higher security, split your root into shares using',
    '  Shamir\'s Secret Sharing. For example, 3-of-5: you get',
    '  five shares and need any three to reconstruct the root.',
    '  Distribute shares to trusted locations or people.',
    '',
    `  ${c.dim}This works for both root types.${c.reset}`,
    '',
    `  ${c.bold}nsec-backed roots${c.reset}`,
    '',
    '  Cannot be recovered from a phrase — there is no phrase.',
    '  Protect the nsec itself, or use Shamir splitting.',
    '  If recovery matters, consider starting with a mnemonic-backed',
    '  root instead.',
    '',
    `  ${c.cyan}Rule of thumb:${c.reset} if you plan to use derived identities`,
    '  long-term, start mnemonic-backed and write down your phrase.',
    '',
    nextSteps([
      'nsec-tree shamir split --shares 3 --threshold 2',
      'nsec-tree explain model',
    ]),
  ])
}

function explainPaths(fmt) {
  const { c, section, boxHeader, nextSteps } = fmt
  return section([
    boxHeader('How do paths work?'),
    '',
    '  A path describes where in your identity tree a derived',
    '  keypair lives. Paths are human-readable strings made of',
    '  segments separated by slashes.',
    '',
    `  ${c.bold}Example paths:${c.reset}`,
    '',
    `    ${c.cyan}personal${c.reset}               one segment, index 0`,
    `    ${c.cyan}personal/forum-burner${c.reset}  nested, two segments`,
    `    ${c.cyan}work@3${c.reset}                 the 4th identity at "work" (0-based)`,
    `    ${c.cyan}personal/forum-burner@2${c.reset}  third forum-burner under personal`,
    '',
    `  ${c.bold}Segment rules:${c.reset}`,
    '',
    '  · Segments are lowercase letters, digits, and hyphens.',
    '  · An optional @N suffix selects an index (default is @0).',
    '  · Nesting is unlimited but keep paths readable.',
    '  · Segment names and indexes are part of the key — changing',
    '    either produces a completely different identity.',
    '',
    `  ${c.bold}Deterministic derivation:${c.reset}`,
    '',
    '  The same root + the same path always produces the same',
    '  keypair. This is the core guarantee: paths are addresses,',
    '  not random names. You can recreate any identity from your',
    '  root and its path alone.',
    '',
    nextSteps([
      'nsec-tree inspect path personal/forum-burner@2',
      'nsec-tree derive path personal/forum-burner',
    ]),
  ])
}

function explainOffline(fmt) {
  const { c, section, boxHeader, nextSteps } = fmt
  return section([
    boxHeader('Why offline-first?'),
    '',
    '  Every nsec-tree operation runs entirely on your machine.',
    '  No DNS lookups. No TLS handshakes. No API calls.',
    '  No relay connections.',
    '',
    '  This is the design, not a limitation.',
    '',
    `  ${c.bold}Why it matters for key material:${c.reset}`,
    '',
    '  · Your root secret never travels over a network.',
    '  · Derived keypairs are computed locally and only published',
    '    when you explicitly choose to.',
    '  · There is no server that could be breached, no token',
    '    that could be intercepted.',
    '',
    `  ${c.bold}Air-gapped workflow:${c.reset}`,
    '',
    `    ${c.cyan}1.${c.reset} Create root on an offline machine.`,
    `    ${c.cyan}2.${c.reset} Derive the identities you need.`,
    `    ${c.cyan}3.${c.reset} Export only the public keys (npubs) or signed events.`,
    `    ${c.cyan}4.${c.reset} Transfer those outputs to an online machine.`,
    `    ${c.cyan}5.${c.reset} Publish to relays — your root stays air-gapped.`,
    '',
    '  For everyday use, running on your laptop is already a',
    '  significant improvement over browser-based key management.',
    '  For high-value roots, full air-gap is straightforward.',
    '',
    `  ${c.dim}"Your most sensitive operation never needs to trust a network."${c.reset}`,
    '',
    nextSteps([
      'nsec-tree root create',
      'nsec-tree explain model',
    ]),
  ])
}

const TOPICS = {
  model: explainModel,
  proofs: explainProofs,
  recovery: explainRecovery,
  paths: explainPaths,
  offline: explainOffline,
}

export function explainTopic(topic, fmt) {
  const fn = TOPICS[topic]
  if (!fn) {
    throw new Error(`Unknown explain topic: "${topic}". Valid topics: ${TOPIC_NAMES.join(', ')}`)
  }
  return fn(fmt)
}
