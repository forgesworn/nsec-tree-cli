import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createFormatter } from '../src/format.js'
import { explainTopic, TOPIC_NAMES } from '../src/explain.js'

const fmt = createFormatter({ colour: false })

describe('explain topics', () => {
  it('exports all five topic names', () => {
    assert.deepStrictEqual(TOPIC_NAMES, ['model', 'proofs', 'recovery', 'paths', 'offline'])
  })

  for (const topic of ['model', 'proofs', 'recovery', 'paths', 'offline']) {
    it(`renders ${topic} topic without errors`, () => {
      const result = explainTopic(topic, fmt)
      assert.ok(result.length > 100, `${topic} should be substantial`)
      assert.ok(typeof result === 'string')
    })

    it(`${topic} topic includes a "Try" suggestion`, () => {
      const result = explainTopic(topic, fmt)
      assert.match(result, /nsec-tree/)
    })
  }

  it('throws for unknown topic', () => {
    assert.throws(() => explainTopic('unknown', fmt), /Unknown explain topic/)
  })
})
