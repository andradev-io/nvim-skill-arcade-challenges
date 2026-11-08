# vendor/

`arcade-editor.js` is the Vim-keys editor used by the *Play it* panel. It is a single minified bundle (no CDN at
runtime) built from `arcade-editor.src.js` with esbuild. Pinned versions, all MIT licensed:

| package | version |
|---|---|
| `@codemirror/state` | 6.5.2 |
| `@codemirror/view` | 6.36.5 |
| `@replit/codemirror-vim` | 6.3.0 |
| `esbuild` (build only) | 0.25.2 |

Rebuild:

```sh
mkdir build && cd build && npm init -y
npm i codemirror@6.0.2 @codemirror/state@6.5.2 @codemirror/view@6.36.5 @replit/codemirror-vim@6.3.0 esbuild@0.25.2
cp ../arcade-editor.src.js entry.js
npx esbuild entry.js --bundle --minify --format=iife --target=es2019 --outfile=../arcade-editor.js
```

Licenses: CodeMirror (c) Marijn Haverbeke and others, MIT; @replit/codemirror-vim (c) Replit, MIT.
