import type { CommitRecord } from './parser.js'

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

export function formatCommits(commits: CommitRecord[], width = 72): string {
  if (commits.length === 0) return '(no commits)'

  return commits
    .map(commit => {
      const prefix = `${commit.abbrevHash}  `
      const indent = ' '.repeat(prefix.length)
      const subjectLines = wrap(commit.subject, Math.max(width - prefix.length, 20))
      const subjectBlock = subjectLines
        .map((line, i) => (i === 0 ? prefix + line : indent + line))
        .join('\n')

      const mergeNote = commit.parents.length > 1 ? `  (merge of ${commit.parents.length})` : ''
      const metaLine = `${indent}${commit.authorName} <${commit.authorEmail}>  ${formatDate(commit.date)}${mergeNote}`

      return `${subjectBlock}\n${metaLine}`
    })
    .join('\n\n')
}
