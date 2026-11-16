import type { RegexTarget } from './types'

/**
 * Convert a simplified Vim-flavored regex pattern to a JavaScript RegExp.
 *
 * Phase 1 supported subset:
 * - Literal characters (escaped as needed for JS regex)
 * - Character classes: [abc], [a-z], [^abc]
 * - Shorthand classes: \d, \w, \s (and uppercase negations)
 * - Dot: . (matches any char except newline)
 * - Quantifiers: *, +, ? (greedy)
 * - Anchors: ^ (start of line), $ (end of line)
 *
 * Unsupported Vim features (deferred to Phase 2):
 * - \(...\) groups, \| alternation, \< \> word boundaries,
 *   \+, \? (Vim's \+ = JS +, Vim's \? = JS ?)
 */
export function vimPatternToJsRegex(pattern: string): RegExp | null {
  if (pattern.length === 0) return null

  try {
    // We process character-by-character to translate Vim syntax to JS syntax.
    // For Phase 1 the translation is mostly identity except for escaping
    // literal characters that are special in JS but not intended as regex
    // operators by the user. However, since we want users to write real
    // regex patterns, we pass the pattern through mostly as-is and rely
    // on the JS regex engine. The main concern is rejecting patterns that
    // would throw.
    const jsPattern = pattern
      // Vim uses \+ for "one or more" which JS also supports as +
      // but Vim's magic mode differs. For Phase 1 we treat input as
      // JS-compatible regex with Vim conventions where they overlap.
      .replace(/\\</g, '\\b')  // \< word boundary start -> \b
      .replace(/\\>/g, '\\b')  // \> word boundary end -> \b

    // Test compilation; return null on invalid pattern
    return new RegExp(jsPattern, 'gm')
  } catch {
    return null
  }
}

/**
 * Evaluate a Vim-flavored regex pattern against buffer lines.
 * Returns all match positions as RegexTarget[].
 * Returns empty array for invalid patterns or no matches.
 */
export function evaluateRegex(pattern: string, bufferLines: string[]): RegexTarget[] {
  const re = vimPatternToJsRegex(pattern)
  if (!re) return []

  const targets: RegexTarget[] = []

  for (let lineIdx = 0; lineIdx < bufferLines.length; lineIdx++) {
    const line = bufferLines[lineIdx]
    // Reset lastIndex for each line since we reuse the same RegExp object
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(line)) !== null) {
      // Avoid infinite loops on zero-length matches
      if (match[0].length === 0) {
        re.lastIndex++
        continue
      }
      targets.push({
        line: lineIdx,
        startCol: match.index,
        endCol: match.index + match[0].length,
      })
    }
  }

  return targets
}

/**
 * Check whether two sets of targets are exactly equal (same set, no extras).
 * Order-independent comparison.
 */
export function matchesExactly(found: RegexTarget[], expected: RegexTarget[]): boolean {
  if (found.length !== expected.length) return false

  // Build a set of keys from expected targets
  const expectedKeys = new Set<string>()
  for (const t of expected) {
    expectedKeys.add(`${t.line}:${t.startCol}:${t.endCol}`)
  }

  // Verify every found target exists in expected set
  for (const t of found) {
    const key = `${t.line}:${t.startCol}:${t.endCol}`
    if (!expectedKeys.has(key)) return false
  }

  return true
}