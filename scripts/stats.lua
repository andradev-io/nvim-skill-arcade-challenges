-- usage: ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/stats.lua [stats-file] [builtin-file]
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
  end
end
local out2 = (arg and arg[2]) or "dist/builtin.json"

vim.fn.mkdir(vim.fn.fnamemodify(out, ":h"), "p")
local f = assert(io.open(out, "w"))
f:write(vim.json.encode({ builtin = #list, areas = areas, levels = levels }))
f:close()
local f2 = assert(io.open(out2, "w"))
f2:write(vim.json.encode({ challenges = items }))
f2:close()
print(("wrote %s: %d built-in challenges, %s: %d for the Terminal"):format(out, #list, out2, #items))
vim.fn.delete(tmp, "rf")
vim.cmd("qa!")
