-- usage: ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/validate.lua [challenges-dir]
-- Validates every challenges/*.json with the plugin's own schema, then replays each reference solution in the
-- real engine. Exit code 1 if anything fails.
local plugin = os.getenv("ARCADE_PLUGIN") or "../nvim-skill-arcade"
vim.opt.rtp:prepend(plugin)
vim.cmd("runtime plugin/skill-arcade.lua")

local tmp = vim.fn.tempname()
require("skill_arcade").setup({ data_dir = tmp, keymaps = false, community = { enabled = false } })
local validate = require("skill_arcade.validate")

local dir = (arg and arg[1]) or "challenges"
local files = vim.fn.glob(dir .. "/*.json", false, true)
table.sort(files)

local failed = 0
for _, path in ipairs(files) do
  local clean, err = validate.file(path)
  if clean then
    print(("ok    %s  (%s, level %d, par %d keys)"):format(path, clean.area, clean.level, require("skill_arcade.keys").count(clean.solution)))
  else
    failed = failed + 1
    print(("FAIL  %s  :: %s"):format(path, err))
  end
end

print(("\n%d challenge(s), %d failed"):format(#files, failed))
vim.fn.delete(tmp, "rf")
vim.cmd(failed == 0 and "qa!" or "cq!")
