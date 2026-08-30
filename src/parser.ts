// git-log-lint expects input produced with a fixed, unambiguous delimiter
// format rather than git's human-oriented default. Field separator is the
// ASCII unit separator, record separator is the ASCII record separator -
// both are control characters that never show up in real commit metadata,
// so we don't need to worry about escaping.
export const FIELD_SEP = '\x1f'
export const RECORD_SEP = '\x1e'

export interface CommitRecord {
  hash: string
  abbrevHash: string
  authorName: string
  authorEmail: string
  date: Date
  parents: string[]
  subject: string
}

export class ParseError extends Error {
  constructor(message: string, public readonly recordIndex: number) {
    super(`record ${recordIndex}: ${message}`)
    this.name = 'ParseError'
  }
}

const FULL_HASH = /^[0-9a-f]{40}$/
const PARTIAL_HASH = /^[0-9a-f]{4,40}$/
// Loose on purpose: git accepts mailbox strings much stranger than a real
// address (empty domains, local delivery names). We only reject fields that
// clearly aren't email-shaped, since the goal is catching malformed input,
// not enforcing RFC 5322.
const EMAIL_SHAPED = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const FIELD_COUNT = 7

function validateRecord(fields: string[], index: number): CommitRecord {
  if (fields.length !== FIELD_COUNT) {
    throw new ParseError(`expected ${FIELD_COUNT} fields, got ${fields.length}`, index)
  }
  const [hash, abbrevHash, authorName, authorEmail, dateStr, parentsStr, subject] = fields as [
    string, string, string, string, string, string, string,
  ]

  if (!FULL_HASH.test(hash)) {
    throw new ParseError(`"${hash}" is not a 40-character lowercase hex commit hash`, index)
  }
  if (!PARTIAL_HASH.test(abbrevHash) || !hash.startsWith(abbrevHash)) {
    throw new ParseError(`abbreviated hash "${abbrevHash}" does not prefix "${hash}"`, index)
  }
  if (authorName.length === 0) {
    throw new ParseError('author name is empty', index)
  }
  if (!EMAIL_SHAPED.test(authorEmail)) {
    throw new ParseError(`"${authorEmail}" is not a valid email address`, index)
  }

  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    throw new ParseError(`"${dateStr}" is not a parseable date`, index)
  }

  const parents = parentsStr.length === 0 ? [] : parentsStr.split(' ')
  for (const parent of parents) {
    if (!PARTIAL_HASH.test(parent)) {
      throw new ParseError(`"${parent}" is not a valid parent hash`, index)
    }
  }

  if (subject.length === 0) {
    throw new ParseError('commit subject is empty', index)
  }

  return { hash, abbrevHash, authorName, authorEmail, date, parents, subject }
}

export function parseLog(input: string): CommitRecord[] {
  const trimmed = input.trim()
  if (trimmed.length === 0) return []

  const records = trimmed
    .split(RECORD_SEP)
    .map(record => record.trim())
    .filter(record => record.length > 0)

  return records.map((record, index) => validateRecord(record.split(FIELD_SEP), index))
}
