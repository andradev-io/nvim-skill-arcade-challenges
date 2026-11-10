import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import type { StreamParser } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/** Colors come from CSS variables so one style serves the light and the dark theme (set on the editor host). */
const V = (name: string, fallback: string) => `var(--syn-${name}, ${fallback})`

export const highlighting: Extension = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: V('keyword', '#a626a4') },
    { tag: [t.string, t.special(t.string), t.regexp], color: V('string', '#50a14f') },
    { tag: [t.number, t.bool, t.null, t.atom], color: V('number', '#b76b01') },
    { tag: [t.comment, t.lineComment, t.blockComment], color: V('comment', '#8a8f98'), fontStyle: 'italic' },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: V('function', '#4078f2') },
    { tag: [t.typeName, t.className, t.namespace], color: V('type', '#0f8b8d') },
    { tag: [t.propertyName, t.attributeName], color: V('property', '#c18401') },
    { tag: [t.operator, t.punctuation, t.separator], color: V('operator', '#6b7280') },
    { tag: [t.tagName, t.heading], color: V('tag', '#e45649') },
    { tag: [t.meta, t.processingInstruction], color: V('meta', '#6b7280') },
    { tag: t.invalid, color: V('invalid', '#e45649') },
  ]),
)

type Loader = () => Promise<StreamParser<unknown>>

const LOADERS: Record<string, Loader> = {
  lua: () => import('@codemirror/legacy-modes/mode/lua').then((m) => m.lua),
  sh: () => import('@codemirror/legacy-modes/mode/shell').then((m) => m.shell),
  bash: () => import('@codemirror/legacy-modes/mode/shell').then((m) => m.shell),
  zsh: () => import('@codemirror/legacy-modes/mode/shell').then((m) => m.shell),
  python: () => import('@codemirror/legacy-modes/mode/python').then((m) => m.python),
  javascript: () => import('@codemirror/legacy-modes/mode/javascript').then((m) => m.javascript),
  javascriptreact: () => import('@codemirror/legacy-modes/mode/javascript').then((m) => m.javascript),
  typescript: () => import('@codemirror/legacy-modes/mode/javascript').then((m) => m.typescript),
  typescriptreact: () => import('@codemirror/legacy-modes/mode/javascript').then((m) => m.typescript),
  json: () => import('@codemirror/legacy-modes/mode/javascript').then((m) => m.json),
  css: () => import('@codemirror/legacy-modes/mode/css').then((m) => m.css),
  scss: () => import('@codemirror/legacy-modes/mode/css').then((m) => m.sCSS),
  html: () => import('@codemirror/legacy-modes/mode/xml').then((m) => m.html),
  xml: () => import('@codemirror/legacy-modes/mode/xml').then((m) => m.xml),
  yaml: () => import('@codemirror/legacy-modes/mode/yaml').then((m) => m.yaml),
  toml: () => import('@codemirror/legacy-modes/mode/toml').then((m) => m.toml),
  sql: () => import('@codemirror/legacy-modes/mode/sql').then((m) => m.standardSQL),
  c: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.c),
  cpp: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.cpp),
  java: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.java),
  cs: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.csharp),
  kotlin: () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.kotlin),
  go: () => import('@codemirror/legacy-modes/mode/go').then((m) => m.go),
  rust: () => import('@codemirror/legacy-modes/mode/rust').then((m) => m.rust),
  ruby: () => import('@codemirror/legacy-modes/mode/ruby').then((m) => m.ruby),
  perl: () => import('@codemirror/legacy-modes/mode/perl').then((m) => m.perl),
  dockerfile: () => import('@codemirror/legacy-modes/mode/dockerfile').then((m) => m.dockerFile),
}

/** Filetypes with highlighting (each parser is loaded on demand, in its own chunk). */
export const HIGHLIGHTED = Object.keys(LOADERS)

/** The language extension for a filetype, or null (plain text, markdown, vim script ...). */
export async function loadLanguage(ft: string): Promise<Extension | null> {
  const load = LOADERS[ft]
  if (!load) return null
  try {
    return StreamLanguage.define(await load())
  } catch {
    return null
  }
}
