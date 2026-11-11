-- usage: ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/stats.lua [out-file]
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

vim.fn.mkdir(vim.fn.fnamemodify(out, ":h"), "p")
local f = assert(io.open(out, "w"))
f:write(vim.json.encode({ builtin = #list, areas = areas, levels = levels }))
f:close()
print(("wrote %s: %d built-in challenges"):format(out, #list))
vim.fn.delete(tmp, "rf")
vim.cmd("qa!")
