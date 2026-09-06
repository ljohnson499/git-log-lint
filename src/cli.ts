#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parseLog, ParseError } from './parser.js'
import { formatCommits, formatCommitsJson } from './printer.js'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function readInput(paths: string[]): Promise<string> {
  if (paths.length === 0) {
    if (process.stdin.isTTY) {
      process.stderr.write('git-log-lint: reading from stdin (pass file paths to read from files instead)\n')
    }
    return readStdin()
  }
  return paths.map(path => readFileSync(path, 'utf8')).join('')
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const jsonIndex = args.indexOf('--json')
  const json = jsonIndex !== -1
  if (json) args.splice(jsonIndex, 1)

  const input = await readInput(args)

  try {
    const commits = parseLog(input)
    process.stdout.write((json ? formatCommitsJson(commits) : formatCommits(commits)) + '\n')
  } catch (err) {
    if (err instanceof ParseError) {
      process.stderr.write(`git-log-lint: ${err.message}\n`)
      process.exitCode = 1
      return
    }
    throw err
  }
}

main().catch(err => {
  process.stderr.write(`git-log-lint: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
