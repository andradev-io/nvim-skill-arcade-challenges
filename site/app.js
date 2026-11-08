// Mirrors lua/skill_arcade/schema.lua so authors get instant feedback. The real gate is CI (schema + replay in Neovim).
(function () {
  "use strict";

  var REPO = "dev-vinicius-andrade/nvim-skill-arcade-challenges";
  var AREAS = ["motions", "textobjects", "editing", "search", "macros", "registers", "marks", "windows", "quickfix", "diagnostics", "plugins"];
  var FILETYPES = ["text", "lua", "python", "javascript", "markdown", "json", "html"];
  var GROUPS = ["jump", "surround", "textobjects", "comment", "picker", "keyhints", "files", "bookmarks", "trouble", "replace", "multicursor", "move", "treesitter"];
  var PRESETS = ["", "diagnostics", "splits", "alt_buffer", "quickfix_hits"];
  var EX_ALLOWED = "s substitute g global v vglobal m move t co copy d delete y yank j join norm normal sort noh nohlsearch tabnew copen cclose cc cn cnext cp cprev vim vimgrep only sp split vs vsplit b buffer tabclose".split(" ");

  var $ = function (id) { return document.getElementById(id); };

  function fill(sel, values, blank) {
    var el = $(sel);
    if (blank) { el.appendChild(new Option(blank, "")); }
    values.forEach(function (v) { el.appendChild(new Option(v === "" ? "none" : v, v)); });
  }
  fill("area", AREAS);
  fill("level", [1, 2, 3, 4, 5].map(String));
  fill("ft", FILETYPES);
  fill("preset", PRESETS);
  fill("hgroup", GROUPS, "(no plugin tip)");
  fill("needs", GROUPS, "(always offer)");
  $("level").value = "2";

  // ── key notation ────────────────────────────────────────────────────────
  function tokens(s) {
    var out = [], i = 0, m;
    while (i < s.length) {
      m = s.slice(i).match(/^<[\w\-]+>/);
      if (s[i] === "<" && m && m[0].length <= 14) { out.push(m[0]); i += m[0].length; }
      else { var cp = String.fromCodePoint(s.codePointAt(i)); out.push(cp); i += cp.length; }
    }
    return out;
  }

  function exName(cmdline) {
    var s = cmdline, before;
    do {
      before = s;
      s = s.replace(/^[\s\d,;%.$+\-]+/, "").replace(/^'[\w<>'`\[\]]/, "").replace(/^\/[^/]*\//, "");
    } while (s !== before);
    var m = s.match(/^[A-Za-z]+/);
    return m ? m[0] : null;
  }

  function unsafeSolution(sol) {
    if (!sol) { return "solution is required"; }
    if (sol.length > 120) { return "solution too long (max 120)"; }
    var low = sol.toLowerCase();
    if (low.indexOf("<c-r>=") >= 0 || sol.indexOf("\\=") >= 0) { return "expression evaluation is not allowed"; }
    if (sol.indexOf(":") >= 0 && /[:\/%\s\d,$.]!/.test(sol)) { return "'!' in a command line is not allowed"; }
    if (sol.indexOf("|") >= 0) { return "'|' command chaining is not allowed"; }
    var pos = 0;
    for (;;) {
      var s = sol.indexOf(":", pos);
      if (s < 0) { break; }
      var e = sol.indexOf("<CR>", s);
      if (e < 0) { e = sol.toLowerCase().indexOf("<cr>", s); }
      if (e < 0) { e = sol.length; }
      var name = exName(sol.slice(s + 1, e));
      if (!name || EX_ALLOWED.indexOf(name) < 0) {
        return "command ':" + (name || sol.slice(s + 1, s + 11)) + "' is not allowed in solutions";
      }
      pos = e + 1;
    }
    return null;
  }

  // ── build + validate ────────────────────────────────────────────────────
  function intOrNull(id) {
    var v = $(id).value.trim();
    return v === "" ? null : Number(v);
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  }

  function parseMarks(s) {
    var out = {}, ok = true;
    s.split(",").forEach(function (part) {
      part = part.trim();
      if (!part) { return; }
      var m = part.match(/^([a-z])\s*=\s*(\d+)$/);
      if (m) { out[m[1]] = Number(m[2]); } else { ok = false; }
    });
    return ok ? out : null;
  }

  function parseRows(s) {
    if (!s.trim()) { return null; }
    var rows = s.split(",").map(function (x) { return Number(x.trim()); });
    return rows.every(function (n) { return Number.isInteger(n) && n > 0; }) ? rows : false;
  }

  function build() {
    var errors = [], c = {};
    var title = $("title").value.trim();
    var id = $("id").value.trim() || slug(title);
    c.id = id;
    c.title = title;
    c.area = $("area").value;
    c.level = Number($("level").value);
    c.brief = $("brief").value.trim();
    var text = $("text").value.replace(/\r\n/g, "\n").replace(/\n+$/, "");
    c.text = text;
    var lines = text === "" ? 0 : text.split("\n").length;
    c.cursor = [Number($("crow").value || 1), Number($("ccol").value || 0)];
    if ($("ft").value !== "text") { c.ft = $("ft").value; }

    var expect = {};
    var et = $("etext").value.replace(/\r\n/g, "\n").replace(/\n+$/, "");
    if (et !== "") { expect.text = et; }
    var er = intOrNull("erow"), ec = intOrNull("ecol");
    if (er !== null) { expect.cursor = ec === null ? [er] : [er, ec]; }
    var w = intOrNull("windows"); if (w !== null) { expect.windows = w; }
    if ($("layout").value) { expect.layout = $("layout").value; }
    var xt = intOrNull("extra_tabs"); if (xt !== null) { expect.extra_tabs = xt; }
    var q = {}, qi = intOrNull("qidx"), qs = intOrNull("qsize");
    if (qi !== null) { q.idx = qi; }
    if (qs !== null) { q.size = qs; }
    if ($("qall").value) { q.all_contain = $("qall").value; }
    if (Object.keys(q).length) { expect.quickfix = q; }
    if ($("float_text").value) { expect.float_text = $("float_text").value; }
    if ($("alt_buffer").checked) { expect.alt_buffer = true; }
    var marks = parseMarks($("marks").value);
    if (marks === null) { errors.push("marks must look like a=3,b=11"); }
    else if (Object.keys(marks).length) { expect.marks = marks; }
    c.expect = expect;

    if ($("preset").value) { c.preset = $("preset").value; }
    var rows = parseRows($("preset_rows").value);
    if (rows === false) { errors.push("preset lines must be positive numbers like 4,9"); }
    else if (rows) { c.preset_rows = rows; }

    c.solution = $("solution").value;
    c.why = $("why").value.trim();
    if ($("hint").value.trim()) { c.hint = $("hint").value.trim(); }
    if ($("author").value.trim()) { c.author = $("author").value.trim(); }
    var pp = intOrNull("plugin_par"); if (pp !== null) { c.plugin_par = pp; }
    if ($("needs").value) { c.needs = $("needs").value; }
    if ($("hgroup").value) {
      if (!$("htip").value.trim()) { errors.push("add a tip for the plugin group"); }
      c.helps = {}; c.helps[$("hgroup").value] = $("htip").value.trim();
    }

    // checks (same rules as schema.lua)
    if (!c.title) { errors.push("title is required"); }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(c.id || "")) { errors.push("id must be lowercase letters, digits and dashes"); }
    if (!c.brief) { errors.push("task description is required"); }
    if (!c.text) { errors.push("start buffer is required"); }
    if (lines > 40) { errors.push("start buffer has more than 40 lines"); }
    if (c.text.length > 2000 || (expect.text || "").length > 2000) { errors.push("text is longer than 2000 characters"); }
    if (!Number.isInteger(c.cursor[0]) || c.cursor[0] < 1 || c.cursor[0] > Math.max(1, lines) || c.cursor[1] < 0) {
      errors.push("cursor is outside the start buffer");
    }
    if (!c.why) { errors.push("explain why (shown after the round)"); }
    var unsafe = unsafeSolution(c.solution);
    if (unsafe) { errors.push(unsafe); }
    if (!Object.keys(expect).length) { errors.push("set at least one expected end state"); }
    if (expect.text !== undefined && expect.text === text && !expect.cursor) { errors.push("expected text equals the start text: nothing to do"); }
    if (c.preset_rows) {
      c.preset_rows.forEach(function (r) { if (r > Math.max(1, lines)) { errors.push("preset line " + r + " is outside the text"); } });
    }
    if ((c.preset === "quickfix_hits" || c.preset === "diagnostics") && !c.preset_rows && c.preset === "quickfix_hits") {
      errors.push("quickfix_hits needs preset lines");
    }
    return { data: c, errors: errors };
  }

  // ── render ──────────────────────────────────────────────────────────────
  var dirtyId = false;
  $("id").addEventListener("input", function () { dirtyId = $("id").value !== ""; });
  $("title").addEventListener("input", function () { if (!dirtyId) { $("id").value = slug($("title").value); } });

  function render() {
    var r = build();
    var json = JSON.stringify(r.data, null, 2) + "\n";
    $("json").textContent = json;
    $("keycount").textContent = $("solution").value ? "par = " + tokens($("solution").value).length + " keys" : "";
    var ul = $("errors");
    ul.innerHTML = "";
    r.errors.forEach(function (e) { var li = document.createElement("li"); li.textContent = e; ul.appendChild(li); });
    $("status").innerHTML = r.errors.length ? "" : '<span class="ok">Looks valid. CI will replay your solution in Neovim.</span>';
    var pr = $("pr");
    var url = "https://github.com/" + REPO + "/new/main?filename=" +
      encodeURIComponent("challenges/" + r.data.id + ".json") + "&value=" + encodeURIComponent(json);
    var okLink = !r.errors.length && url.length < 7500;
    pr.href = okLink ? url : "#";
    pr.classList.toggle("disabled", !okLink);
    pr.title = (!r.errors.length && !okLink) ? "Too long for a link: use Copy JSON" : "";
    renderTry(r);
    renderSim(r);
    renderPlay(r);
    return { json: json, id: r.data.id, ok: !r.errors.length };
  }

  // ── test in Neovim: one-line :ArcadeTry command ─────────────────────────
  function store(k, v) {
    try { if (v === undefined) { return localStorage.getItem(k); } localStorage.setItem(k, v); } catch (e) { /* private mode */ }
    return null;
  }
  $("dlfolder").value = store("arcade-folder") || "~/Downloads";

  function tryCommand(id) {
    var folder = $("dlfolder").value.trim().replace(/[\\\/]+$/, "") || "~/Downloads";
    var path = (folder + "/" + (id || "challenge") + ".json").replace(/ /g, "\\ ");
    return ":ArcadeTry " + path;
  }

  // room code: ARC1.<base64url of the minified draft JSON>. Decoded and schema-checked by the plugin.
  function draftCode(data) {
    var bytes = new TextEncoder().encode(JSON.stringify(data)), bin = "";
    for (var i = 0; i < bytes.length; i++) { bin += String.fromCharCode(bytes[i]); }
    return "ARC1." + btoa(bin).split("+").join("-").split("/").join("_").replace(/=+$/, "");
  }

  function renderTry(r) {
    var bad = r.errors.length > 0;
    var code = draftCode(r.data);
    $("cmd").textContent = ":ArcadeJoin " + code;
    $("filecmd").textContent = tryCommand(r.data.id);
    $("copycmd").classList.toggle("disabled", bad);
    $("dlcopy").classList.toggle("disabled", bad);
    $("codeinfo").textContent = bad ? "" : "Room code: " + code.length + " characters.";
    $("trynote").textContent = bad
      ? "Fix the errors on the left first: Neovim refuses drafts that break the safety schema."
      : "Needs a nvim-skill-arcade version with :ArcadeJoin / :ArcadeTry (update the plugin if the command is missing).";
  }

  function copyText(s) {
    if (navigator.clipboard && navigator.clipboard.writeText) { return navigator.clipboard.writeText(s).catch(function () {}); }
    var t = document.createElement("textarea");
    t.value = s; document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(t);
  }
  function flash(btn, msg) {
    var old = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = old; }, 1400);
  }
  function downloadJson(r) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([r.json], { type: "application/json" }));
    a.download = (r.id || "challenge") + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  $("dlfolder").addEventListener("input", function () { store("arcade-folder", $("dlfolder").value); render(); });
  $("copycmd").addEventListener("click", function () { copyText($("cmd").textContent); flash($("copycmd"), "Copied"); });
  $("dlcopy").addEventListener("click", function () {
    var r = render();
    if (!r.ok) { return; }
    downloadJson(r);
    copyText($("filecmd").textContent);
    flash($("dlcopy"), "Downloaded, command copied");
  });

  // ── in-page simulator ───────────────────────────────────────────────────
  function verdict(kind, tag, msg) {
    var d = document.createElement("div");
    d.className = "verdict v-" + kind;
    var b = document.createElement("span"); b.className = "tag"; b.textContent = tag;
    d.appendChild(b); d.appendChild(document.createTextNode(msg));
    return d;
  }
  function withCursor(text, cur) {
    var lines = text.split("\n");
    return lines.map(function (l, i) { return i === (cur[0] - 1) ? l + "   <- cursor " + cur[0] + "," + cur[1] : l; }).join("\n");
  }

  function renderSim(r) {
    var c = r.data, e = c.expect || {};
    var box = $("simverdict");
    box.innerHTML = "";
    var startCur = c.cursor || [1, 0];
    $("simstart").textContent = withCursor(c.text || "", startCur);
    $("simexp").textContent = e.text !== undefined ? e.text + (e.cursor ? "\n\n-- cursor: " + e.cursor.join(",") : "") : (e.cursor ? "-- cursor: " + e.cursor.join(",") : "(no text expectation)");

    var simpleOnly = ["text", "cursor"];
    var others = Object.keys(e).filter(function (k) { return simpleOnly.indexOf(k) < 0; });
    if (!Object.keys(e).length || !c.text) {
      box.appendChild(verdict("info", "wait", "Fill the start buffer and an expected end state to run the check."));
      $("simreplay").textContent = "";
      return;
    }
    if (others.length) {
      box.appendChild(verdict("info", "note", "Also checked, but only in Neovim: " + others.join(", ") + ". Use Test in Neovim for those."));
    }

    var sims = e.text !== undefined || e.cursor;
    if (!sims) { $("simreplay").textContent = ""; return; }
    var startState = { text: c.text, cursor: startCur };
    var at0 = ArcadeSim.check({ text: e.text, cursor: e.cursor }, startState, false);
    if (e.text !== undefined && ArcadeSim.linesEqual(c.text, e.text, false) && !e.cursor) {
      box.appendChild(verdict("bad", "start", "The start buffer already equals the expected text: nothing to do."));
    } else if (at0.ok && others.length === 0) {
      box.appendChild(verdict("bad", "start", "Already solved at the start. CI rejects that: change the start or the expected state."));
    } else {
      box.appendChild(verdict("ok", "start", "Not solved at the start, good."));
    }

    // reference replay
    var rep = c.solution ? ArcadeSim.replay(c.text, startCur, c.solution) : null;
    var pre = $("simreplay");
    if (!rep) {
      pre.textContent = "";
    } else if (rep.unsupported) {
      pre.textContent = "(stopped at " + rep.unsupported + ")";
      box.appendChild(verdict("info", "replay", "Cannot preview '" + rep.unsupported + "' here. That is fine: use Test in Neovim to be sure."));
    } else {
      pre.textContent = withCursor(rep.text, rep.cursor);
      var chk = ArcadeSim.check({ text: e.text, cursor: e.cursor }, rep, !!c.loose);
      if (others.length) {
        box.appendChild(verdict("info", "replay", "Text/cursor part: " + (chk.ok ? "reached" : "not reached") + " by the reference keys."));
      } else if (chk.ok) {
        box.appendChild(verdict("ok", "replay", "Reference keys reach the expected state (" + ArcadeSim.tokens(c.solution).length + " keys)."));
      } else {
        var which = chk.parts.filter(function (p) { return !p.ok; }).map(function (p) { return p.name; }).join(" and ");
        box.appendChild(verdict("bad", "replay", "Reference keys do not reach the expected " + which + ". Compare the buffers below (the preview is approximate)."));
      }
    }

  }

  // ── Play it: real Vim keys in the browser (stock Vim emulation) ─────────
  var ed = null, draft = null, loadedKey = null;
  var play = { keys: 0, t0: null, timer: null, passed: null };

  function ensureEditor() {
    if (!ed && window.ArcadeEditor) {
      ed = window.ArcadeEditor.create($("editor"), { onKey: onPlayKey, onUpdate: evalPlay });
    }
    return ed;
  }
  function parOf(c) { return c.solution ? ArcadeSim.tokens(c.solution).length : 0; }
  function secs() { return play.t0 === null ? 0 : (performance.now() - play.t0) / 1000; }
  function keyRank(keys, par) {
    if (!par) { return ""; }
    return keys <= par ? "S" : keys <= par * 1.5 ? "A" : keys <= par * 2 ? "B" : "C";
  }

  function paintBar() {
    var par = draft ? parOf(draft) : 0;
    var badge = $("pbadge");
    var done = play.passed;
    var keys = done ? done.keys : play.keys;
    var t = done ? done.secs : secs();
    $("pkeys").textContent = "keys " + keys + " / par " + (par || "-") + (par && done ? "  (" + keyRank(keys, par) + ")" : "");
    $("ptime").textContent = t.toFixed(1) + "s";
    $("pmode").textContent = ed ? ed.mode() : "normal";
    if (done) { badge.textContent = "PASS"; badge.className = "badge pass"; }
    else if (play.t0 !== null) { badge.textContent = "playing"; badge.className = "badge run"; }
    else { badge.textContent = "ready"; badge.className = "badge"; }
  }
  function stopTimer() { if (play.timer) { clearInterval(play.timer); play.timer = null; } }

  function onPlayKey() {
    if (play.passed) { return; }
    play.keys++;
    if (play.t0 === null) {
      play.t0 = performance.now();
      play.timer = setInterval(paintBar, 100);
    }
  }

  function playable(c) {
    var e = c && c.expect;
    return !!(e && (e.text !== undefined || e.cursor) && c.text);
  }

  function evalPlay() {
    if (!ed || !draft) { return; }
    paintBar();
    var detail = $("pdetail");
    if (!playable(draft)) {
      detail.textContent = "Add start text and an expected text or cursor to play. Other assertions only run in Neovim.";
      return;
    }
    if (play.passed) {
      var p = play.passed, par = parOf(draft);
      detail.textContent = "Solved in " + p.keys + " keys and " + p.secs.toFixed(1) + "s" +
        (par ? " (par " + par + " keys, key rank " + keyRank(p.keys, par) + ")" : "") + ". Reset to try another route.";
      return;
    }
    if (play.keys === 0) { detail.textContent = "Click the editor and play. The clock starts on your first key."; return; }
    // same semantics as the plugin: end state only, and the editor must be in normal mode
    var state = { text: ed.text(), cursor: ed.cursor() };
    var chk = ArcadeSim.check({ text: draft.expect.text, cursor: draft.expect.cursor }, state, !!draft.loose);
    if (chk.ok && ed.mode() === "normal") {
      play.passed = { keys: play.keys, secs: secs() };
      stopTimer();
      paintBar();
      return evalPlay();
    }
    var miss = chk.parts.filter(function (x) { return !x.ok; }).map(function (x) { return x.name; });
    detail.textContent = ed.mode() !== "normal" && chk.ok
      ? "State matches, but you are in " + ed.mode() + " mode: press Esc (the game also needs normal mode)."
      : "Not there yet: " + miss.join(" and ") + " differ" + (miss.length === 1 ? "s" : "") + ".";
  }

  function resetPlay() {
    if (!ensureEditor() || !draft) { return; }
    stopTimer();
    play.keys = 0; play.t0 = null; play.passed = null;
    ed.setText(draft.text || "", draft.cursor || [1, 0]);
    paintBar();
    evalPlay();
  }

  function renderPlay(r) {
    var c = r.data;
    draft = c;
    var flags = $("playflags");
    flags.innerHTML = "";
    function flag(msg) { var p = document.createElement("p"); p.className = "flag"; p.textContent = msg; flags.appendChild(p); }
    var e = c.expect || {};
    var others = Object.keys(e).filter(function (k) { return k !== "text" && k !== "cursor"; });
    if (c.needs || c.area === "plugins" || (c.helps && Object.keys(c.helps).length)) {
      flag("Plugin-specific challenge: your plugins are not simulated here. Only the stock-Vim route can be played; check the plugin route in Neovim.");
    }
    if (others.length) { flag("Not checkable in the browser: " + others.join(", ") + ". They are only judged in Neovim."); }
    if (c.preset) { flag("Preset '" + c.preset + "' (diagnostics, windows, quickfix ...) is not created here."); }

    var exp = $("pexptext");
    exp.textContent = (e.text !== undefined ? e.text : "(no text expectation)") + (e.cursor ? "\n\n-- cursor: row " + e.cursor[0] + (e.cursor[1] !== undefined ? ", col " + e.cursor[1] : "") : "");

    if (!ensureEditor()) {
      $("pdetail").textContent = "The editor script did not load (vendor/arcade-editor.js).";
      return;
    }
    var key = JSON.stringify([c.text, c.cursor]);
    if (key !== loadedKey) { loadedKey = key; resetPlay(); } else { evalPlay(); }
  }

  $("preplay").addEventListener("click", function () { resetPlay(); if (ed) { ed.focus(); } });
  $("pshow").addEventListener("click", function () {
    var box = $("pexpected"), open = box.hidden;
    box.hidden = !open;
    $("pshow").setAttribute("aria-expanded", String(open));
    $("pshow").textContent = open ? "Hide expected" : "Show expected";
  });

  // ── theme toggle (auto -> follows the system; click to force) ───────────
  (function () {
    var root = document.documentElement;
    function current() {
      var t = root.getAttribute("data-theme");
      if (t) { return t; }
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    function label() { $("theme").textContent = current() === "dark" ? "light mode" : "dark mode"; }
    $("theme").addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      store("arcade-theme", next);
      label();
    });
    label();
  })();

  Array.prototype.forEach.call(document.querySelectorAll("#form input, #form textarea, #form select"), function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });

  $("copy").addEventListener("click", function () {
    var r = render();
    if (navigator.clipboard) { navigator.clipboard.writeText(r.json); }
  });
  $("download").addEventListener("click", function () {
    var r = render();
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([r.json], { type: "application/json" }));
    a.download = (r.id || "challenge") + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ── published list ──────────────────────────────────────────────────────
  var published = [];
  function renderList() {
    var f = $("filter").value.toLowerCase();
    var ul = $("list");
    ul.innerHTML = "";
    var shown = published.filter(function (c) {
      return !f || [c.title, c.area, c.author || ""].join(" ").toLowerCase().indexOf(f) >= 0;
    });
    shown.forEach(function (c) {
      var li = document.createElement("li");
      var b = document.createElement("b"); b.textContent = c.title;
      var s = document.createElement("small");
      s.textContent = "  " + c.area + " - level " + c.level + (c.author ? " - by " + c.author : "");
      li.appendChild(b); li.appendChild(s);
      ul.appendChild(li);
    });
    $("count").textContent = published.length ? shown.length + " of " + published.length : "nothing published yet";
  }
  $("filter").addEventListener("input", renderList);
  fetch("community.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : { challenges: [] }; })
    .then(function (d) { published = d.challenges || []; renderList(); })
    .catch(function () { $("count").textContent = "list unavailable offline"; });

  render();
})();
