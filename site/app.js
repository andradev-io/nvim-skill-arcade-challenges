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
    return { json: json, id: r.data.id, ok: !r.errors.length };
  }

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
