-- usage: ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/stats.lua [stats-file] [builtin-file] [community-bundle]
-- Counts the plugin's built-in challenges so the home page shows real numbers instead of a typed-in one.
local plugin = os.getenv("ARCADE_PLUGIN") or "../nvim-skill-arcade"
vim.opt.rtp:prepend(plugin)
vim.cmd("runtime plugin/skill-arcade.lua")

local tmp = vim.fn.tempname()
require("skill_arcade").setup({ data_dir = tmp, keymaps = false, community = { enabled = false } })
local catalog = require("skill_arcade.catalog")

local out = (arg and arg[1]) or "dist/stats.json"
local areas, levels = {}, {}
local list = catalog.builtin()
for _, ch in ipairs(list) do
  areas[ch.area] = (areas[ch.area] or 0) + 1
  levels[tostring(ch.level)] = (levels[tostring(ch.level)] or 0) + 1
end

-- the built-ins that are plain text (no tracks, plugin groups or game-made setups): the Terminal page lists them
local items = {}
for _, ch in ipairs(list) do
  if not ch.track and not ch.needs and not ch.setup and ch.lines and #ch.lines > 0 then
    items[#items + 1] = {
      id = ch.id, title = ch.title, area = ch.area, level = ch.level, ft = ch.ft,
      text = table.concat(ch.lines, "\n"), cursor = ch.cursor, brief = ch.brief,
    }
    -- judged in the browser when the end state is plain buffer text and/or the cursor. A custom check cannot be
    -- exported, except for the refactor sprints, whose check only re-runs the Lua (the text already decides).
    local e = ch.expect
    if e and (e.lines or e.cursor) and (not ch.check or ch.area == "refactor") then
      local it = items[#items]
      it.expect = { text = e.lines and table.concat(e.lines, "\n") or nil, cursor = e.cursor }
      it.loose = ch.loose or nil
      it.par_keys, it.par_seconds, it.why = ch.par_keys, ch.par_seconds, ch.why
      it.solution = type(ch.solution) == "string" and ch.solution or nil
    end
  end
end
local out2 = (arg and arg[2]) or "dist/builtin.json"

vim.fn.mkdir(vim.fn.fnamemodify(out, ":h"), "p")
local f = assert(io.open(out, "w"))
-- the model-written challenges: counted from the bundle build.lua just wrote (the same validated entries the plugin reads)
local ai_n = 0
local bundle = (arg and arg[3]) or "dist/community.json"
local bf = io.open(bundle, "r")
if bf then
  local ok, data = pcall(vim.json.decode, bf:read("*a"))
  bf:close()
  if ok and type(data) == "table" then
    ai_n = #(data.ai or {})
  end
end
f:write(vim.json.encode({ builtin = #list, ai = ai_n, areas = areas, levels = levels }))
f:close()
local f2 = assert(io.open(out2, "w"))
f2:write(vim.json.encode({ challenges = items }))
f2:close()
local judged = 0
for _, it in ipairs(items) do
  judged = judged + (it.expect and 1 or 0)
end
print(("wrote %s: %d built-in challenges, %s: %d for the Terminal (%d judged)"):format(out, #list, out2, #items, judged))
vim.fn.delete(tmp, "rf")
vim.cmd("qa!")
