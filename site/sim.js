// Tiny in-page preview of a challenge. Two parts:
//  1. check()   - the SAME end-state comparison the game uses for `expect.text` / `expect.cursor`
//                 (trailing spaces and trailing blank lines ignored; `loose` also ignores leading spaces).
//  2. replay()  - an APPROXIMATE interpreter for common normal-mode keys, so an author can see whether the
//                 reference solution reaches the expected state. It is not Neovim: unsupported keys are
//                 reported, never guessed. The CI replay in real Neovim stays the authority.
(function (root) {
  "use strict";

  // ── same comparison as catalog.lines_equal ────────────────────────────────
  function trimLines(text, loose) {
    var out = String(text).replace(/\r\n/g, "\n").split("\n").map(function (l) {
      l = l.replace(/\s+$/, "");
      return loose ? l.replace(/^\s+/, "") : l;
    });
    while (out.length && out[out.length - 1] === "") { out.pop(); }
    return out;
  }
  function linesEqual(a, b, loose) {
    var x = trimLines(a, loose), y = trimLines(b, loose);
    return x.length === y.length && x.every(function (l, i) { return l === y[i]; });
  }

  // expect: { text?, cursor? [row, col?] }; state: { text, cursor [row, col] (1-based row, 0-based col) }
  function check(expect, state, loose) {
    var res = { ok: true, parts: [] };
    if (expect.text !== undefined) {
      var okText = linesEqual(state.text, expect.text, loose);
      res.parts.push({ name: "text", ok: okText });
      res.ok = res.ok && okText;
    }
    if (expect.cursor) {
      var okCur = state.cursor[0] === expect.cursor[0] && (expect.cursor[1] === undefined || state.cursor[1] === expect.cursor[1]);
      res.parts.push({ name: "cursor", ok: okCur });
      res.ok = res.ok && okCur;
    }
    if (!res.parts.length) { res.ok = false; }
    return res;
  }

  // ── key tokens (same notation rules as the plugin) ────────────────────────
  function tokens(s) {
    var out = [], i = 0, m;
    while (i < s.length) {
      m = s.slice(i).match(/^<[\w\-]+>/);
      if (s[i] === "<" && m && m[0].length <= 14) { out.push(m[0]); i += m[0].length; }
      else { var cp = String.fromCodePoint(s.codePointAt(i)); out.push(cp); i += cp.length; }
    }
    return out;
  }

  var lit = function (t) { return t === "<Space>" ? " " : t === "<lt>" ? "<" : t; };
  var cls = function (ch) { return /\s/.test(ch) ? 0 : /\w/.test(ch) ? 2 : 1; };

  // ── replay ────────────────────────────────────────────────────────────────
  function replay(text, cursor, solution) {
    var lines = String(text).replace(/\r\n/g, "\n").split("\n");
    var r = Math.max(0, Math.min(lines.length, cursor[0] || 1) - 1);
    var c = cursor[1] || 0;
    var reg = { s: "", line: false };
    var toks = tokens(solution), i = 0;
    var fail = null;

    function clamp() {
      r = Math.max(0, Math.min(lines.length - 1, r));
      c = Math.max(0, Math.min(Math.max(0, lines[r].length - 1), c));
    }
    function off(rr, cc) { var o = 0; for (var k = 0; k < rr; k++) { o += lines[k].length + 1; } return o + cc; }
    function pos(o) {
      var rr = 0;
      while (rr < lines.length - 1 && o > lines[rr].length) { o -= lines[rr].length + 1; rr++; }
      return [rr, o];
    }
    function flat() { return lines.join("\n"); }
    function setFlat(s) { lines = s.split("\n"); }
    function unsupported(what) { fail = what; }

    // motions return { o: offset, inclusive } or { line: n } (linewise); null = unsupported
    function motion(k, count, arg) {
      var f = flat(), o = off(r, c), L = lines[r], n, p;
      switch (k) {
        case "h": return { o: Math.max(off(r, 0), o - count) };
        case "l": return { o: Math.min(off(r, L.length), o + count) };
        case "0": return { o: off(r, 0) };
        case "^": return { o: off(r, Math.max(0, L.search(/\S/))) };
        case "$": return { o: off(r, Math.max(0, L.length - 1)), inclusive: true };
        case "w": case "W":
          p = o;
          for (n = 0; n < count; n++) {
            var c0 = cls(f[p] || " ");
            while (p < f.length && c0 !== 0 && cls(f[p]) === c0 && f[p] !== "\n") { p++; }
            while (p < f.length && (cls(f[p]) === 0)) { p++; }
          }
          return { o: Math.min(p, f.length) };
        case "e":
          p = o;
          for (n = 0; n < count; n++) {
            p++;
            while (p < f.length && cls(f[p]) === 0) { p++; }
            var c1 = cls(f[p] || " ");
            while (p + 1 < f.length && cls(f[p + 1]) === c1 && c1 !== 0) { p++; }
          }
          return { o: Math.min(p, f.length - 1), inclusive: true };
        case "b":
          p = o;
          for (n = 0; n < count; n++) {
            p--;
            while (p > 0 && cls(f[p]) === 0) { p--; }
            var c2 = cls(f[p] || " ");
            while (p > 0 && cls(f[p - 1]) === c2) { p--; }
          }
          return { o: Math.max(0, p) };
        case "j": return { line: Math.min(lines.length - 1, r + count), from: r };
        case "k": return { line: Math.max(0, r - count), from: r };
        case "G": return { line: arg === "none" ? lines.length - 1 : Math.min(lines.length - 1, count - 1), from: r };
        case "f": case "t": case "F": case "T":
          p = c;
          for (n = 0; n < count; n++) {
            if (k === "f" || k === "t") { p = L.indexOf(arg, p + 1); }
            else { p = p < 1 ? -1 : L.lastIndexOf(arg, p - 1); }
            if (p < 0) { return null; }
          }
          if (k === "t") { p--; }
          if (k === "T") { p++; }
          return { o: off(r, p), inclusive: k === "f" || k === "t" };
      }
      return null;
    }

    // text objects return [start, endExclusive] offsets
    function textObject(kind, ch) {
      var f = flat(), o = off(r, c), L = lines[r], base = off(r, 0), s, e;
      if (ch === "w") {
        s = c; e = c;
        var k0 = cls(L[c] || " ");
        while (s > 0 && cls(L[s - 1]) === k0) { s--; }
        while (e < L.length && cls(L[e]) === k0) { e++; }
        if (kind === "a") {
          if (k0 !== 0 && L[e] === " ") { while (e < L.length && cls(L[e]) === 0) { e++; } }
          else { while (s > 0 && cls(L[s - 1]) === 0) { s--; } }
        }
        return [base + s, base + e];
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        var qs = [], q = -1;
        while ((q = L.indexOf(ch, q + 1)) >= 0) { qs.push(q); }
        for (var k = 0; k + 1 < qs.length; k += 2) {
          if (c <= qs[k + 1]) {
            return kind === "i" ? [base + qs[k] + 1, base + qs[k + 1]] : [base + qs[k], base + qs[k + 1] + 1];
          }
        }
        return null;
      }
      var pairs = { "(": "()", ")": "()", b: "()", "[": "[]", "]": "[]", "{": "{}", "}": "{}", B: "{}", "<": "<>", ">": "<>" };
      if (pairs[ch]) {
        var open = pairs[ch][0], close = pairs[ch][1], depth = 0;
        for (s = o; s >= 0; s--) {
          if (f[s] === close && s !== o) { depth++; }
          else if (f[s] === open) { if (depth === 0) { break; } depth--; }
        }
        if (s < 0) { return null; }
        depth = 0;
        for (e = s + 1; e < f.length; e++) {
          if (f[e] === open) { depth++; }
          else if (f[e] === close) { if (depth === 0) { break; } depth--; }
        }
        if (e >= f.length) { return null; }
        return kind === "i" ? [s + 1, e] : [s, e + 1];
      }
      return null;
    }

    function putCursor(o) { var p = pos(o); r = p[0]; c = p[1]; clamp(); }

    function deleteRange(a, b, yankOnly) {
      var f = flat();
      reg = { s: f.slice(a, b), line: false };
      if (!yankOnly) { setFlat(f.slice(0, a) + f.slice(b)); }
      putCursor(a);
    }
    function deleteLines(a, b, yankOnly) {
      reg = { s: lines.slice(a, b + 1).join("\n"), line: true };
      if (!yankOnly) { lines.splice(a, b - a + 1); if (!lines.length) { lines = [""]; } }
      r = Math.min(a, lines.length - 1);
      if (!yankOnly) { c = Math.max(0, lines[r].search(/\S/)); }
      clamp();
    }

    function readInsert(insertAt) {
      // insertAt: offset where text goes. consume tokens until <Esc>
      var f = flat(), o = insertAt, buf = "";
      while (i < toks.length && toks[i] !== "<Esc>" && toks[i] !== "<C-[>") {
        var t = toks[i++];
        if (t === "<CR>") { buf += "\n"; }
        else if (t === "<Space>") { buf += " "; }
        else if (t === "<BS>") { buf = buf.slice(0, -1); }
        else if (t === "<C-r>") { var rr = toks[i++]; if (rr === '"' || rr === "0") { buf += reg.s; } else { unsupported("<C-r>" + rr); return; } }
        else if (t.length > 1 && t[0] === "<") { unsupported(t); return; }
        else { buf += t; }
      }
      i++; // <Esc>
      setFlat(f.slice(0, o) + buf + f.slice(o));
      putCursor(o + Math.max(0, buf.length - 1));
    }

    function readCount() {
      var n = "";
      while (i < toks.length && /^[0-9]$/.test(toks[i]) && !(n === "" && toks[i] === "0")) { n += toks[i++]; }
      return n === "" ? null : Number(n);
    }

    function exCommand() {
      var s = "";
      while (i < toks.length && toks[i] !== "<CR>") { s += toks[i] === "<Space>" ? " " : toks[i]; i++; }
      i++;
      var m = s.match(/^(%)?s\/([^\/\\]*)\/([^\/\\]*)\/([gi]*)$/);
      if (m) {
        var re = new RegExp(m[2], m[4].indexOf("g") >= 0 ? "g" : "");
        var rep = m[3];
        if (m[1]) { lines = lines.map(function (l) { return l.replace(re, rep); }); }
        else { lines[r] = lines[r].replace(re, rep); }
        clamp();
        return;
      }
      if (/^\d+$/.test(s)) { r = Number(s) - 1; c = 0; clamp(); return; }
      if (s === "noh" || s === "nohlsearch") { return; }
      unsupported(":" + s);
    }

    while (i < toks.length && !fail) {
      var count = readCount(), cnt = count || 1;
      var t = toks[i++];
      if (t === undefined) { break; }
      var o = off(r, c), L = lines[r], mo;
      switch (t) {
        case "<Esc>": break;
        case "i": readInsert(o); break;
        case "a": readInsert(Math.min(o + 1, off(r, L.length))); break;
        case "I": readInsert(off(r, Math.max(0, L.search(/\S/)))); break;
        case "A": readInsert(off(r, L.length)); break;
        case "o": lines.splice(r + 1, 0, ""); r++; c = 0; readInsert(off(r, 0)); break;
        case "O": lines.splice(r, 0, ""); c = 0; readInsert(off(r, 0)); break;
        case "x": deleteRange(o, Math.min(off(r, L.length), o + cnt)); break;
        case "D": deleteRange(o, off(r, L.length)); break;
        case "C": deleteRange(o, off(r, L.length)); readInsert(off(r, lines[r].length)); break;
        case "J": if (r + 1 < lines.length) { lines[r] = L.replace(/\s+$/, "") + " " + lines[r + 1].replace(/^\s+/, ""); lines.splice(r + 1, 1); c = L.replace(/\s+$/, "").length; clamp(); } break;
        case "~": lines[r] = L.slice(0, c) + (L[c] === L[c].toUpperCase() ? L[c].toLowerCase() : L[c].toUpperCase()) + L.slice(c + 1); c = Math.min(c + 1, L.length - 1); break;
        case "r": { var ch = toks[i++]; if (ch && ch.length === 1 && L.length > c) { lines[r] = L.slice(0, c) + ch + L.slice(c + 1); } else { unsupported("r" + ch); } break; }
        case "p": case "P":
          if (!reg.s && !reg.line) { break; }
          if (reg.line) {
            var at = t === "p" ? r + 1 : r;
            lines.splice.apply(lines, [at, 0].concat(reg.s.split("\n")));
            r = at; c = Math.max(0, lines[r].search(/\S/)); clamp();
          } else {
            var po = t === "p" ? Math.min(o + 1, off(r, L.length)) : o, f = flat();
            setFlat(f.slice(0, po) + reg.s + f.slice(po));
            putCursor(po + reg.s.length - 1);
          }
          break;
        case ":": exCommand(); break;
        case "g":
          if (toks[i] === "g") { i++; r = count ? Math.min(lines.length, count) - 1 : 0; c = Math.max(0, lines[r].search(/\S/)); clamp(); }
          else { unsupported("g" + (toks[i] || "")); }
          break;
        case "d": case "c": case "y": {
          var cnt2 = readCount(), total = cnt * (cnt2 || 1);
          var k = toks[i++];
          if (k === t) { // dd cc yy
            var last = Math.min(lines.length - 1, r + total - 1);
            if (t === "y") { deleteLines(r, last, true); }
            else if (t === "d") { deleteLines(r, last); }
            else { reg = { s: lines.slice(r, last + 1).join("\n"), line: true }; lines.splice(r, last - r + 1, ""); c = 0; readInsert(off(r, 0)); }
            break;
          }
          if (k === "i" || k === "a") {
            var obj = textObject(k, toks[i++]);
            if (!obj) { unsupported(t + k + (toks[i - 1] || "")); break; }
            if (t === "y") { deleteRange(obj[0], obj[1], true); putCursor(obj[0]); }
            else { deleteRange(obj[0], obj[1]); if (t === "c") { readInsert(obj[0]); } }
            break;
          }
          var arg = null;
          if (k === "f" || k === "t" || k === "F" || k === "T") { arg = lit(toks[i++]); }
          if (k === "G") { arg = count || cnt2 ? "n" : "none"; }
          var wk = k;
          if (t === "c" && (k === "w") && /\S/.test(L[c] || " ")) { wk = "e"; }
          mo = motion(wk, total, arg);
          if (!mo) { unsupported(t + (k || "")); break; }
          if (mo.line !== undefined) {
            var a = Math.min(mo.from, mo.line), b = Math.max(mo.from, mo.line);
            if (t === "y") { deleteLines(a, b, true); }
            else if (t === "d") { deleteLines(a, b); }
            else { reg = { s: lines.slice(a, b + 1).join("\n"), line: true }; lines.splice(a, b - a + 1, ""); r = a; c = 0; readInsert(off(r, 0)); }
            break;
          }
          var s0 = o, e0 = mo.o + (mo.inclusive ? 1 : 0);
          if (e0 < s0) { var tmp = s0; s0 = e0; e0 = tmp; }
          if (t === "y") { deleteRange(s0, e0, true); putCursor(s0); }
          else { deleteRange(s0, e0); if (t === "c") { readInsert(s0); } }
          break;
        }
        default:
          if (t === "f" || t === "t" || t === "F" || t === "T") { mo = motion(t, cnt, lit(toks[i++])); }
          else if (t === "G" && !count) { mo = motion("G", 1, "none"); }
          else { mo = motion(t, cnt, count ? "n" : "none"); }
          if (!mo) { unsupported(t); break; }
          if (mo.line !== undefined) { r = mo.line; c = (t === "G") ? Math.max(0, lines[r].search(/\S/)) : Math.min(c, Math.max(0, lines[r].length - 1)); }
          else { putCursor(mo.o); }
      }
      if (!fail) { clamp(); }
    }
    return { text: lines.join("\n"), cursor: [r + 1, c], unsupported: fail };
  }

  var api = { check: check, replay: replay, tokens: tokens, linesEqual: linesEqual };
  root.ArcadeSim = api;
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
})(typeof window !== "undefined" ? window : globalThis);
