-- Explicit context sharing only. No keystroke stream and no automatic shell capture.
local source = debug.getinfo(1, 'S').source:sub(2)
local repo = vim.fn.fnamemodify(source, ':h:h')

local function root_for(file)
  local current = vim.fn.fnamemodify(file, ':p:h')
  while current ~= '' do
    if vim.fn.isdirectory(current .. '/.learning') == 1 then return current end
    local parent = vim.fn.fnamemodify(current, ':h')
    if parent == current then break end
    current = parent
  end
end

local function send(opts)
  local file = vim.api.nvim_buf_get_name(0)
  if file == '' then vim.notify('Save/name the exercise file first', vim.log.levels.WARN); return end
  local root = root_for(file)
  if not root then vim.notify('No initialized learning workspace', vim.log.levels.ERROR); return end
  local relative = file:sub(#root + 2)
  local first, last = 0, -1
  if opts.range > 0 then
    first = opts.line1 - 1
    last = opts.line2
  end
  local text = table.concat(vim.api.nvim_buf_get_lines(0, first, last, false), '\n')
  if #text > 10000 then vim.notify('Choose a smaller selection (max 10 KB)', vim.log.levels.WARN); return end
  vim.ui.select({ 'Queue selected context', 'Cancel' }, { prompt = 'Share public learning context only; do not send secrets.' }, function(choice)
    if choice ~= 'Queue selected context' then return end
    local job = vim.fn.jobstart({ 'node', repo .. '/scripts/event.mjs', root, 'editor', relative }, {
      stdout_buffered = true, stderr_buffered = true,
      on_stdout = function(_, data) vim.schedule(function() local msg = table.concat(data, '\n'); if msg ~= '' then vim.notify(msg) end end) end,
      on_stderr = function(_, data) vim.schedule(function() local msg = table.concat(data, '\n'); if msg ~= '' then vim.notify(msg, vim.log.levels.ERROR) end end) end,
    })
    if job <= 0 then vim.notify('Cannot start Node bridge', vim.log.levels.ERROR); return end
    vim.fn.chansend(job, text)
    vim.fn.chanclose(job, 'stdin')
  end)
end

-- Explicit classroom "Cek draft publik" action is approval to share this buffer,
-- not to write/close it. Request IDs correlate snapshots with the waiting tutor.
vim.api.nvim_create_user_command('LearningSnapshot', function(opts)
  local id, encoded = opts.fargs[1], opts.fargs[2]
  if not id or not id:match('^[a-zA-Z0-9%-]+$') or not encoded or not encoded:match('^[0-9a-f]+$') or #encoded % 2 ~= 0 then return end
  local expected = encoded:gsub('..', function(pair) return string.char(tonumber(pair, 16)) end)
  local file = vim.api.nvim_buf_get_name(0)
  -- Scope approval BEFORE reading/exporting a different buffer's contents.
  if file ~= expected then vim.notify('Select the requested public exercise buffer before sharing', vim.log.levels.WARN); return end
  local root = root_for(file)
  if not root then return end
  local relative = file:sub(#root + 2)
  local text = table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\n')
  if #text > 8000 then text = text:sub(1, 8000) .. '\n[partial snapshot: first 8 KB]' end
  local job = vim.fn.jobstart({ 'node', repo .. '/scripts/event.mjs', root, 'editor', relative }, { stdout_buffered = true, stderr_buffered = true })
  if job <= 0 then return end
  vim.fn.chansend(job, '__learning_snapshot:' .. id .. '\n' .. text)
  vim.fn.chanclose(job, 'stdin')
end, { nargs = '+', desc = 'Share requested public buffer snapshot only after classroom request' })

vim.api.nvim_create_user_command('LearningSend', function(opts) send(opts) end, { range = true, desc = 'Queue buffer/selected lines for Pi' })
vim.keymap.set('n', '<leader>ls', '<cmd>LearningSend<CR>', { desc = 'Send learning buffer to Pi' })
vim.keymap.set('x', '<leader>ls', ":LearningSend<CR>", { desc = 'Send selected learning lines to Pi' })
