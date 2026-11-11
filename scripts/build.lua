-- usage: ARCADE_PLUGIN=../nvim-skill-arcade nvim --headless -u NONE -l scripts/build.lua [challenges-dir[,more-dirs]] [out-file]
-- Validates + replays every challenge (same as validate.lua), then writes the bundle the plugin downloads
-- with :ArcadeSync. Fails (and writes nothing) if any challenge is invalid.
local plugin = os.getenv("ARCADE_PLUGIN") or "../nvim-skill-arcade"
vim.opt.rtp:prepend(plugin)
vim.cmd("runtime plugin/skill-arcade.lua")

local tmp = vim.fn.tempname()
require("skill_arcade").setup({ data_dir = tmp, keymaps = false, community = { enabled = false } })
local validate = require("skill_arcade.validate")

local dir = (arg and arg[1]) or "challenges"
local out = (arg and arg[2]) or "dist/community.json"
-- several directories can be given, separated by commas (challenges,daily)
local files = {}
for _, d in ipairs(vim.split(dir, ",", { plain = true, trimempty = true })) do
  vim.list_extend(files, vim.fn.glob(d .. "/*.json", false, true))
end
table.sort(files)

local list, failed = {}, 0
for _, path in ipairs(files) do
  local clean, err = validate.file(path)
  if clean then
    list[#list + 1] = clean
  else
    failed = failed + 1
    print(("FAIL  %s  :: %s"):format(path, err))
  end
end
if failed > 0 then
  vim.cmd("cq!")
end

vim.fn.mkdir(vim.fn.fnamemodify(out, ":h"), "p")
local f = assert(io.open(out, "w"))
f:write(vim.json.encode({ version = 1, count = #list, challenges = list }))
f:close()
print(("built %s with %d challenge(s)"):format(out, #list))
vim.fn.delete(tmp, "rf")
vim.cmd("qa!")
