import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGraphRows } from './graph.js'
import type { CommitRecord } from './parser.js'

const HASH_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const HASH_B1 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const HASH_B2 = 'cccccccccccccccccccccccccccccccccccccccc'
const HASH_C = 'dddddddddddddddddddddddddddddddddddddddd'

function commit(hash: string, parents: string[]): CommitRecord {
  return {
    hash,
    abbrevHash: hash.slice(0, 7),
    authorName: 'Jane Doe',
    authorEmail: 'jane@example.com',
    date: new Date('2026-03-01T10:22:00Z'),
    parents,
    subject: 'subject',
  }
}

test('a single root commit occupies one lane with no branch line', () => {
  const [row] = buildGraphRows([commit(HASH_A, [])])
  assert.equal(row?.head, '*')
  assert.equal(row?.continuation, '|')
  assert.equal(row?.branchOut, null)
})

test('linear history stays in a single lane for every commit', () => {
  const rows = buildGraphRows([commit(HASH_C, [HASH_B1]), commit(HASH_B1, [HASH_A]), commit(HASH_A, [])])
  for (const row of rows) {
    assert.equal(row.head, '*')
    assert.equal(row.continuation, '|')
    assert.equal(row.branchOut, null)
  }
})

test('a merge commit opens a new lane for its second parent', () => {
  const [row] = buildGraphRows([commit(HASH_C, [HASH_B1, HASH_B2]), commit(HASH_B1, [HASH_A]), commit(HASH_B2, [HASH_A]), commit(HASH_A, [])])
  assert.equal(row?.head, '*')
  assert.equal(row?.continuation, '|')
  assert.equal(row?.branchOut, '| \\')
})

test('branches converging back on a shared ancestor collapse into one lane', () => {
  const rows = buildGraphRows([
    commit(HASH_C, [HASH_B1, HASH_B2]),
    commit(HASH_B1, [HASH_A]),
    commit(HASH_B2, [HASH_A]),
    commit(HASH_A, []),
  ])
  const [, b1Row, b2Row, aRow] = rows

  assert.equal(b1Row?.head, '* |')
  assert.equal(b2Row?.head, '| *')
  // both incoming lanes are still visible on A's own row...
  assert.equal(aRow?.head, '* |')
  // ...but nothing is left waiting afterward: a following root commit
  // reuses lane 0 rather than opening a third lane.
  const [, , , , nextRoot] = buildGraphRows([
    commit(HASH_C, [HASH_B1, HASH_B2]),
    commit(HASH_B1, [HASH_A]),
    commit(HASH_B2, [HASH_A]),
    commit(HASH_A, []),
    commit('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', []),
  ])
  assert.equal(nextRoot?.head, '*')
})
