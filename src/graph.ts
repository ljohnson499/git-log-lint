import type { CommitRecord } from './parser.js'

// Lane tracking for ASCII graph rendering, in the spirit of `git log --graph`
// but deliberately simpler: lanes are only ever appended or reused from a
// freed slot, never reshuffled to close up gaps in the middle. That trades
// away some of the tight diagonal crossings git draws for a version that's
// easy to reason about and still gets the topology right.

export interface GraphRow {
  // prefix for the commit's first printed line, with '*' marking its lane
  head: string
  // prefix for any further lines belonging to the same commit (wrapped
  // subject lines, the author/date line) - same lanes, no '*'
  continuation: string
  // an extra full-width line to print after the commit's block when it
  // opened new lanes for a merge, or null if nothing changed shape
  branchOut: string | null
}

// Parent hashes may be abbreviated, and two references to the same commit
// aren't always abbreviated to the same length, so treat either string being
// a prefix of the other as a match.
function hashesMatch(a: string, b: string): boolean {
  return a === b || a.startsWith(b) || b.startsWith(a)
}

function render(symbols: string[]): string {
  return symbols.join(' ')
}

export function buildGraphRows(commits: CommitRecord[]): GraphRow[] {
  // lanes[i] holds the hash of the commit that lane is waiting to reach, or
  // '' if the lane is free and can be reused for the next branch we meet.
  const lanes: string[] = []
  const rows: GraphRow[] = []

  for (const commit of commits) {
    let column = lanes.findIndex(expected => expected !== '' && hashesMatch(commit.hash, expected))
    if (column === -1) {
      column = lanes.indexOf('')
      if (column === -1) column = lanes.length
    }
    while (lanes.length <= column) lanes.push('')

    const before = lanes.slice()
    const headSymbols = before.map((expected, i) => (i === column ? '*' : expected === '' ? ' ' : '|'))
    // The commit's own lane is active for this row even if nothing was
    // pointing at it before now (a brand-new branch tip has no history yet).
    const continuationSymbols = before.map((expected, i) => (i === column ? '|' : expected === '' ? ' ' : '|'))

    // Other lanes that were also waiting on this same commit (parallel
    // branches converging here) collapse into this one instead of hanging
    // around forever waiting for a commit that already went by.
    for (let i = 0; i < lanes.length; i++) {
      if (i !== column && lanes[i] !== '' && hashesMatch(commit.hash, lanes[i]!)) {
        lanes[i] = ''
      }
    }

    lanes[column] = commit.parents[0] ?? ''

    const openedColumns: number[] = []
    for (const parent of commit.parents.slice(1)) {
      const alreadyTracked = lanes.some(expected => expected !== '' && hashesMatch(parent, expected))
      if (alreadyTracked) continue

      let slot = lanes.indexOf('')
      if (slot === -1) slot = lanes.length
      lanes[slot] = parent
      openedColumns.push(slot)
    }

    while (lanes.length > 0 && lanes[lanes.length - 1] === '') lanes.pop()

    let branchOut: string | null = null
    if (openedColumns.length > 0) {
      const branchSymbols = lanes.map((expected, i) => {
        if (i === column) return '|'
        if (openedColumns.includes(i)) return '\\'
        return expected === '' ? ' ' : '|'
      })
      branchOut = render(branchSymbols)
    }

    rows.push({ head: render(headSymbols), continuation: render(continuationSymbols), branchOut })
  }

  return rows
}
