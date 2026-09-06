import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCommits, formatCommitsJson } from './printer.js'
import type { CommitRecord } from './parser.js'

const HASH = 'a1b2c3d4e5f6789012345678901234567890abcd'

function commit(overrides: Partial<CommitRecord> = {}): CommitRecord {
  return {
    hash: HASH,
    abbrevHash: HASH.slice(0, 7),
    authorName: 'Jane Doe',
    authorEmail: 'jane@example.com',
    date: new Date('2026-03-01T10:22:00Z'),
    parents: [],
    subject: 'fix off-by-one in wrap()',
    ...overrides,
  }
}

test('formatCommits prints (no commits) for an empty list', () => {
  assert.equal(formatCommits([]), '(no commits)')
})

test('formatCommits includes a merge note only for multiple parents', () => {
  const single = formatCommits([commit({ parents: [HASH.slice(0, 8)] })])
  assert.doesNotMatch(single, /merge of/)

  const merge = formatCommits([commit({ parents: [HASH.slice(0, 8), HASH.slice(0, 8)] })])
  assert.match(merge, /\(merge of 2\)/)
})

test('formatCommitsJson round-trips commit data through JSON', () => {
  const [parsed] = JSON.parse(formatCommitsJson([commit()])) as Array<Record<string, unknown>>
  assert.equal(parsed?.hash, HASH)
  assert.equal(parsed?.date, '2026-03-01T10:22:00.000Z')
  assert.deepEqual(parsed?.parents, [])
})

test('formatCommitsJson produces an empty array for no commits', () => {
  assert.equal(formatCommitsJson([]), '[]')
})
