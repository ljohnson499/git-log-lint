import type { CommitRecord } from './parser.js'
import { buildGraphRows } from './graph.js'

// Date isn't JSON-serializable in the shape we want (JSON.stringify would
// produce the same ISO string anyway, but being explicit keeps the output
// format a documented contract rather than an accident of Date's toJSON).
type JsonCommitRecord = Omit<CommitRecord, 'date'> & { date: string }

export function formatCommitsJson(commits: CommitRecord[]): string {
  const records: JsonCommitRecord[] = commits.map(commit => ({
    ...commit,
    date: commit.date.toISOString(),
  }))
  return JSON.stringify(records, null, 2)
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 16) + 'Z'
}

function wrap(text: string, width: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (current.length > 0 && current.length + 1 + word.length > width) {
      lines.push(current)
      current = word
    } else {
      current = current.length === 0 ? word : `${current} ${word}`
    }
  }
  if (current.length > 0) lines.push(current)

  return lines
}

const ANSI = {
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
}

// Wrapping happens on the plain text, before color codes are added, so line
// widths aren't thrown off by escape sequences that print with zero width.
function paint(code: string, text: string, color: boolean): string {
  return color ? `${code}${text}${ANSI.reset}` : text
}

export interface FormatCommitsOptions {
  width?: number
  color?: boolean
  graph?: boolean
}

export function formatCommits(commits: CommitRecord[], options: FormatCommitsOptions = {}): string {
  if (commits.length === 0) return '(no commits)'

  const { width = 72, color = false, graph = false } = options
  const graphRows = graph ? buildGraphRows(commits) : null

  return commits
    .map((commit, i) => {
      const row = graphRows?.[i]
      const graphHead = row ? `${row.head} ` : ''
      const graphCont = row ? `${row.continuation} ` : ''
      const hashIndent = ' '.repeat(commit.abbrevHash.length + 2)

      const subjectLines = wrap(commit.subject, Math.max(width - graphHead.length - hashIndent.length, 20))
      const subjectBlock = subjectLines
        .map((line, j) =>
          j === 0
            ? graphHead + paint(ANSI.yellow, commit.abbrevHash, color) + '  ' + line
            : graphCont + hashIndent + line
        )
        .join('\n')

      const mergeNote = commit.parents.length > 1
        ? paint(ANSI.magenta, `  (merge of ${commit.parents.length})`, color)
        : ''
      const author = paint(ANSI.cyan, `${commit.authorName} <${commit.authorEmail}>`, color)
      const date = paint(ANSI.dim, formatDate(commit.date), color)
      const metaLine = `${graphCont}${hashIndent}${author}  ${date}${mergeNote}`
      const branchOutLine = row?.branchOut ? `\n${row.branchOut}` : ''

      return `${subjectBlock}\n${metaLine}${branchOutLine}`
    })
    .join('\n\n')
}
