import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createFormatter } from '../src/format.js'

describe('createFormatter', () => {
  describe('with colour enabled', () => {
    const fmt = createFormatter({ colour: true })

    it('wraps label-value with ANSI codes', () => {
      const result = fmt.labelValue('root type', 'mnemonic-backed')
      assert.match(result, /\x1b\[/)
      assert.match(result, /root type/)
      assert.match(result, /mnemonic-backed/)
    })

    it('renders a box header with box-drawing characters', () => {
      const result = fmt.boxHeader('Root created')
      assert.match(result, /╭/)
      assert.match(result, /╰/)
      assert.match(result, /Root created/)
    })

    it('renders a warning with ANSI yellow', () => {
      const result = fmt.warning('Store this mnemonic offline.')
      assert.match(result, /\x1b\[33m/)
      assert.match(result, /Store this mnemonic offline/)
    })

    it('renders success with green checkmark', () => {
      const result = fmt.success('Proof is valid')
      assert.match(result, /\x1b\[32m/)
      assert.match(result, /Proof is valid/)
    })

    it('renders failure with red cross', () => {
      const result = fmt.failure('Proof is invalid')
      assert.match(result, /\x1b\[31m/)
      assert.match(result, /Proof is invalid/)
    })

    it('renders next steps with dim header', () => {
      const result = fmt.nextSteps(['nsec-tree derive path personal'])
      assert.match(result, /Try next/)
      assert.match(result, /nsec-tree derive path personal/)
    })

    it('wraps mnemonic words at content width', () => {
      const words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      const result = fmt.wrapWords(words)
      const lines = result.split('\n')
      assert.ok(lines.length >= 2, 'mnemonic should wrap to multiple lines')
    })
  })

  describe('with colour disabled', () => {
    const fmt = createFormatter({ colour: false })

    it('renders label-value without ANSI codes', () => {
      const result = fmt.labelValue('root type', 'mnemonic-backed')
      assert.doesNotMatch(result, /\x1b\[/)
      assert.match(result, /root type/)
      assert.match(result, /mnemonic-backed/)
    })

    it('renders box header without ANSI codes', () => {
      const result = fmt.boxHeader('Root created')
      assert.doesNotMatch(result, /\x1b\[/)
      assert.match(result, /╭/)
      assert.match(result, /Root created/)
    })

    it('renders warning without ANSI codes', () => {
      const result = fmt.warning('Sensitive output.')
      assert.doesNotMatch(result, /\x1b\[/)
      assert.match(result, /Sensitive output/)
    })
  })

  describe('tree rendering', () => {
    const fmt = createFormatter({ colour: false })

    it('renders single-segment path', () => {
      const result = fmt.renderTree([
        { name: 'personal', requestedIndex: 0, actualIndex: 0, npub: 'npub1abc' },
      ])
      assert.match(result, /root/)
      assert.match(result, /└─/)
      assert.match(result, /personal@0/)
      assert.match(result, /npub1abc/)
    })

    it('renders nested path with proper indentation', () => {
      const result = fmt.renderTree([
        { name: 'personal', requestedIndex: 0, actualIndex: 0, npub: 'npub1abc' },
        { name: 'forum-burner', requestedIndex: 0, actualIndex: 0, npub: 'npub1def' },
      ])
      assert.match(result, /root/)
      assert.match(result, /└─ personal@0/)
      assert.match(result, /└─ forum-burner@0/)
      const lines = result.split('\n')
      const personalLine = lines.find(l => l.includes('personal@0'))
      const burnerLine = lines.find(l => l.includes('forum-burner@0'))
      const personalIndent = personalLine.search(/\S/)
      const burnerIndent = burnerLine.search(/\S/)
      assert.ok(burnerIndent > personalIndent, 'child should be indented further than parent')
    })

    it('marks the last segment as leaf', () => {
      const result = fmt.renderTree([
        { name: 'personal', requestedIndex: 0, actualIndex: 0, npub: 'npub1abc' },
      ])
      assert.match(result, /leaf/)
    })
  })
})
