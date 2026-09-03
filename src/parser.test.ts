import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLog, ParseError, FIELD_SEP, RECORD_SEP } from './parser.js'

const HASH_A = 'a1b2c3d4e5f6789012345678901234567890abcd'.slice(0, 40)
const HASH_B = 'b2c3d4e5f6789012345678901234567890abcd12'.slice(0, 40)

function record(fields: string[]): string {
  return fields.join(FIELD_SEP)
}

function log(...records: string[]): string {
  return records.join(RECORD_SEP) + RECORD_SEP
}

const VALID_FIELDS = [
  HASH_A,
  HASH_A.slice(0, 7),
  'Jane Doe',
  'jane@example.com',
  '2026-03-01T10:22:00Z',
  '',
  'fix off-by-one in wrap()',
]

test('parses a single well-formed record with no parents', () => {
  const [commit] = parseLog(log(record(VALID_FIELDS)))
  assert.equal(commit?.hash, HASH_A)
  assert.equal(commit?.abbrevHash, HASH_A.slice(0, 7))
  assert.equal(commit?.authorName, 'Jane Doe')
  assert.equal(commit?.authorEmail, 'jane@example.com')
  assert.deepEqual(commit?.parents, [])
  assert.equal(commit?.subject, 'fix off-by-one in wrap()')
})

test('parses merge commits with multiple parents', () => {
  const fields = [...VALID_FIELDS]
  fields[5] = `${HASH_A.slice(0, 8)} ${HASH_B.slice(0, 8)}`
  const [commit] = parseLog(log(record(fields)))
  assert.deepEqual(commit?.parents, [HASH_A.slice(0, 8), HASH_B.slice(0, 8)])
})

test('parses multiple records in order', () => {
  const second = [...VALID_FIELDS]
  second[6] = 'second commit'
  const commits = parseLog(log(record(VALID_FIELDS), record(second)))
  assert.equal(commits.length, 2)
  assert.equal(commits[0]?.subject, 'fix off-by-one in wrap()')
  assert.equal(commits[1]?.subject, 'second commit')
})

test('returns an empty array for blank input', () => {
  assert.deepEqual(parseLog(''), [])
  assert.deepEqual(parseLog('   \n  '), [])
})

test('rejects a record with the wrong field count', () => {
  const fields = VALID_FIELDS.slice(0, 6)
  assert.throws(() => parseLog(log(record(fields))), (err: unknown) => {
    assert.ok(err instanceof ParseError)
    assert.match(err.message, /expected 7 fields, got 6/)
    return true
  })
})

test('rejects a hash that is not 40 lowercase hex characters', () => {
  const fields = [...VALID_FIELDS]
  fields[0] = 'not-a-hash'
  assert.throws(() => parseLog(log(record(fields))), /is not a 40-character lowercase hex commit hash/)
})

test('rejects an uppercase hash', () => {
  const fields = [...VALID_FIELDS]
  fields[0] = HASH_A.toUpperCase()
  assert.throws(() => parseLog(log(record(fields))), /is not a 40-character lowercase hex commit hash/)
})

test('rejects an abbreviated hash that does not prefix the full hash', () => {
  const fields = [...VALID_FIELDS]
  fields[1] = HASH_B.slice(0, 7)
  assert.throws(() => parseLog(log(record(fields))), /does not prefix/)
})

test('rejects an empty author name', () => {
  const fields = [...VALID_FIELDS]
  fields[2] = ''
  assert.throws(() => parseLog(log(record(fields))), /author name is empty/)
})

test('rejects an email with no @ or no domain dot', () => {
  for (const bad of ['jane', 'jane@', '@example.com', 'jane@examplecom']) {
    const fields = [...VALID_FIELDS]
    fields[3] = bad
    assert.throws(() => parseLog(log(record(fields))), /is not a valid email address/, `expected "${bad}" to be rejected`)
  }
})

test('rejects a date that Date cannot parse', () => {
  const fields = [...VALID_FIELDS]
  fields[4] = 'not-a-date'
  assert.throws(() => parseLog(log(record(fields))), /is not a parseable date/)
})

test('rejects a malformed parent hash', () => {
  const fields = [...VALID_FIELDS]
  fields[5] = 'zzzzzzz'
  assert.throws(() => parseLog(log(record(fields))), /is not a valid parent hash/)
})

test('rejects an empty subject', () => {
  const fields = [...VALID_FIELDS]
  fields[6] = ''
  assert.throws(() => parseLog(log(record(fields))), /commit subject is empty/)
})

test('error message includes the zero-based record index of the failing record', () => {
  const bad = [...VALID_FIELDS]
  bad[0] = 'not-a-hash'
  assert.throws(() => parseLog(log(record(VALID_FIELDS), record(bad))), (err: unknown) => {
    assert.ok(err instanceof ParseError)
    assert.equal(err.recordIndex, 1)
    assert.match(err.message, /^record 1:/)
    return true
  })
})
