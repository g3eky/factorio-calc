-- Runs Factorio's data stage from wube/factorio-data outside the game and writes data.raw as JSON.
-- Usage: luajit dump.lua <factorio-data dir> <output.json> <mod> [<mod> ...]
-- Mods are loaded in the order given, after core.

local root, out_path = arg[1], arg[2]
local MODS = { "core" }
for i = 3, #arg do MODS[#MODS + 1] = arg[i] end

local function read_json_version(mod)
  local f = io.open(root .. "/" .. mod .. "/info.json")
  if not f then return nil end
  local s = f:read("*a")
  f:close()
  return s:match('"version"%s*:%s*"([^"]+)"')
end

-- Wube's Lua runs in a sandbox: it gets only pure functions (string, table, math, ...) and the
-- Factorio globals below. No io, os, debug, package, ffi, load*/dofile or getfenv/setfenv,
-- so it can build tables but can't touch files, processes or the network.
local env = {
  assert = assert, error = error, ipairs = ipairs, next = next, pairs = pairs, pcall = pcall,
  rawequal = rawequal, rawget = rawget, rawset = rawset, select = select, setmetatable = setmetatable,
  getmetatable = getmetatable, tonumber = tonumber, tostring = tostring, type = type, unpack = unpack,
  xpcall = xpcall,
  string = string, math = math,
  table = { concat = table.concat, insert = table.insert, remove = table.remove, sort = table.sort, unpack = unpack },
}
env._G = env

env.mods = {}
for _, mod in ipairs(MODS) do
  if mod ~= "core" then env.mods[mod] = read_json_version(mod) end
end

-- Feature flags are on when a loaded mod requires them ("quality_required": true in info.json),
-- as in the game: Space Age turns them on, the base game alone leaves them off.
env.feature_flags = {
  quality = false, space_travel = false, spoiling = false, freezing = false,
  segmented_units = false, expansion_shaders = false, rail_bridges = false,
}
for _, mod in ipairs(MODS) do
  local f = io.open(root .. "/" .. mod .. "/info.json")
  if f then
    local info = f:read("*a")
    f:close()
    for flag in info:gmatch('"([%w_]+)_required"%s*:%s*true') do
      if env.feature_flags[flag] ~= nil then env.feature_flags[flag] = true end
    end
  end
end

-- defines.* is only used for constants in the data stage.
local function lazy_defines(path)
  return setmetatable({}, {
    __index = function(t, k)
      local v = lazy_defines(path .. "." .. tostring(k))
      rawset(t, k, v)
      return v
    end,
    __tostring = function() return path end,
  })
end
env.defines = lazy_defines("defines")
rawset(env.defines, "constant", { default_icon_size = 64 })

env.log = function() end
env.table_size = function(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end
env.serpent = {
  block = function(v) return tostring(v) end,
  line = function(v) return tostring(v) end,
  dump = function(v) return tostring(v) end,
}

-- Factorio-style require: "__mod__/path", relative to the current file, the mod root, or core/lualib.
local loaded = {}
local current = { mod = "core", dir = root .. "/core" }

local function read_file(path)
  local f = io.open(path)
  if not f then return nil end
  local s = f:read("*a")
  f:close()
  return s
end

-- Lua 5.2 (Factorio) reads "f\n(args)" as a call; LuaJIT (5.1) rejects it as ambiguous.
-- Whitespace doesn't change meaning, so move each such "(" up to just after the previous token.
-- A small scanner skips strings and comments so only real code is touched.
local function fix_call_newlines(src)
  local out, i, n = {}, 1, #src
  local last_code = 0 -- index in `out` of the last code token
  local newline_since = false

  local function long_bracket_end(pos)
    local eq = src:match("^%[(=*)%[", pos)
    if not eq then return nil end
    local _, close = src:find("]" .. eq .. "]", pos + #eq + 2, true)
    return close or n
  end

  while i <= n do
    local c = src:sub(i, i)
    if c == "-" and src:sub(i + 1, i + 1) == "-" then
      local close = long_bracket_end(i + 2)
      local stop = close or (src:find("\n", i, true) or n + 1) - 1
      out[#out + 1] = src:sub(i, stop)
      i = stop + 1
    elseif c == "\n" then
      newline_since = true
      out[#out + 1] = c
      i = i + 1
    elseif c:match("%s") then
      out[#out + 1] = c
      i = i + 1
    else
      local stop
      if c == '"' or c == "'" then
        local j = i + 1
        while j <= n do
          local d = src:sub(j, j)
          if d == "\\" then
            j = j + 2
          elseif d == c then
            break
          else
            j = j + 1
          end
        end
        stop = j
      elseif c == "[" then
        stop = long_bracket_end(i) or i
      else
        stop = i
      end
      local token = src:sub(i, stop)
      if token == "(" and newline_since and last_code > 0 then
        out[last_code] = out[last_code] .. " ("
      else
        out[#out + 1] = token
        last_code = #out
      end
      newline_since = false
      i = stop + 1
    end
  end
  return table.concat(out)
end

local function run_file(file, mod, source)
  source = fix_call_newlines(source)
  local chunk = assert(loadstring(source, "@" .. file:sub(#root + 2)))
  setfenv(chunk, env)
  local saved = current
  current = { mod = mod, dir = file:match("^(.*)/[^/]*$") }
  local result = chunk()
  current = saved
  return result
end

-- Stands in for any graphics data: sprite fields are set, any other key gives another stub.
local stub_meta = {}
local function graphics_stub()
  return setmetatable({ width = 1, height = 1, shift = { 0, 0 }, line_length = 1, frames = 1 }, {
    __index = function(_, key) if key ~= "filenames" then return graphics_stub() end end,
    __metatable = stub_meta,
  })
end

env.require = function(name)
  assert(type(name) == "string" and not name:find("..", 1, true), "require: bad name")
  local mod, path = name:match("^__([%w%-_]+)__[/.](.+)$")
  mod = mod or current.mod
  path = (path or name):gsub("%.lua$", "")
  local candidates = {}
  for _, p in ipairs({ path, (path:gsub("%.", "/")) }) do
    if not name:match("^__") then table.insert(candidates, current.dir .. "/" .. p .. ".lua") end
    table.insert(candidates, root .. "/" .. mod .. "/" .. p .. ".lua")
    table.insert(candidates, root .. "/core/lualib/" .. p .. ".lua")
  end
  for _, file in ipairs(candidates) do
    if loaded[file] ~= nil then return loaded[file] end
    local source = read_file(file)
    if source then
      local file_mod = file:sub(#root + 2):match("^([^/]+)")
      loaded[file] = true
      local result = run_file(file, file_mod, source)
      if result ~= nil then loaded[file] = result end
      return loaded[file]
    end
  end
  -- Graphics, sound and menu simulation data are not in factorio-data, and do not matter here.
  local slashed = path:gsub("%.", "/")
  if slashed:match("^graphics/") or slashed:match("^menu%-simulations/") or slashed:match("^sound/") then
    return graphics_stub()
  end
  error("require: cannot find " .. name .. " (from " .. current.dir .. ")")
end

-- Factorio's Lua iterates tables in a fixed order, and the data stage depends on it (e.g. which
-- recycling recipes get generated). LuaJIT's order varies between runs, so data.raw and its
-- per-type tables remember insertion order, and the sandbox's pairs follows it.
local insertion_order = setmetatable({}, { __mode = "k" })

local function ordered_table()
  local keys, seen = {}, {}
  local t = setmetatable({}, {
    __newindex = function(t, k, v)
      if v ~= nil and not seen[k] then
        seen[k] = true
        keys[#keys + 1] = k
      end
      rawset(t, k, v)
    end,
  })
  insertion_order[t] = keys
  return t
end

env.pairs = function(t)
  local keys = insertion_order[t]
  if not keys then return pairs(t) end
  local i = 0
  return function()
    repeat
      i = i + 1
      local k = keys[i]
      if k == nil then return nil end
      local v = rawget(t, k)
      if v ~= nil then return k, v end
    until false
  end, t, nil
end

-- data:extend that ignores stubbed (graphics/sound) prototypes and keeps data.raw ordered.
local function wrap_extend()
  local extend = env.data.extend
  env.data.raw = ordered_table()
  env.data.extend = function(self, list)
    if list == nil then list = self end
    local kept = {}
    for _, proto in ipairs(list) do
      if getmetatable(proto) ~= stub_meta then
        kept[#kept + 1] = proto
        if env.data.raw[proto.type] == nil then env.data.raw[proto.type] = ordered_table() end
      end
    end
    if #kept > 0 then extend(env.data, kept) end
  end
end

local function run_stage(stage)
  for _, mod in ipairs(MODS) do
    local file = root .. "/" .. mod .. "/" .. stage .. ".lua"
    local source = read_file(file)
    if source then run_file(file, mod, source) end
  end
end

-- defines.prototypes: base type -> every concrete subtype, from core's prototype hierarchy.
do
  local prototypes = {}
  local function collect(set, name, children)
    if not children._abstract then set[name] = 0 end
    for child, grandchildren in pairs(children) do
      if child ~= "_abstract" then collect(set, child, grandchildren) end
    end
  end
  for base_type, children in pairs(env.require("prototype-hierarchy")) do
    prototypes[base_type] = {}
    collect(prototypes[base_type], base_type, children)
  end
  rawset(env.defines, "prototypes", prototypes)
end

-- Settings stage, so settings.startup has every default value.
env.require("dataloader")
wrap_extend()
run_stage("settings")
run_stage("settings-updates")
run_stage("settings-final-fixes")
env.settings = { startup = {} }
for type_name, protos in pairs(env.data.raw) do
  if type_name:match("%-setting$") then
    for name, proto in pairs(protos) do env.settings.startup[name] = { value = proto.default_value } end
  end
end

-- Data stage.
loaded = {}
env.require("dataloader")
wrap_extend()
run_stage("data")
run_stage("data-updates")
run_stage("data-final-fixes")
local data = env.data

-- JSON output, dropping graphics, sounds and functions.
local SKIP_KEYS = {
  pictures = true, picture = true, animation = true, animations = true, graphics_set = true,
  graphics_set_flipped = true, sprites = true, sprite = true, sound = true, sounds = true,
  working_sound = true, open_sound = true, close_sound = true, integration_patch = true,
  water_reflection = true, corpse = true, dying_explosion = true, damaged_trigger_effect = true,
  circuit_connector = true, circuit_wire_max_distance = true, icons_positioning = true,
  crafting_machine_tint = true, wet_mining_graphics_set = true, base_picture = true,
  variations = true, layers = true, shadow = true, frames = true, stages = true,
  map_color = true, created_effect = true, trigger = true,
}

local out = {}
local function emit(s) out[#out + 1] = s end

local function encode(v, depth)
  local t = type(v)
  if t == "string" then
    emit('"' .. v:gsub('[%c"\\]', function(c)
      return string.format("\\u%04x", c:byte())
    end) .. '"')
  elseif t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then emit("null")
    elseif v == math.floor(v) and math.abs(v) < 1e15 then emit(string.format("%d", v))
    else emit(string.format("%.17g", v)) end
  elseif t == "boolean" then
    emit(tostring(v))
  elseif t == "table" then
    if depth > 30 then emit("null") return end
    local n = #v
    local is_array = n > 0 or next(v) == nil
    if is_array then
      for k in pairs(v) do
        if type(k) ~= "number" or k < 1 or k > n or k % 1 ~= 0 then is_array = false break end
      end
    end
    if is_array and n > 0 then
      emit("[")
      for i = 1, n do
        if i > 1 then emit(",") end
        encode(v[i], depth + 1)
      end
      emit("]")
    elseif next(v) == nil then
      emit("{}")
    else
      emit("{")
      local keys = {}
      for k in pairs(v) do
        if not SKIP_KEYS[k] and type(v[k]) ~= "function" then keys[#keys + 1] = k end
      end
      table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
      for i, k in ipairs(keys) do
        if i > 1 then emit(",") end
        encode(tostring(k), depth + 1)
        emit(":")
        encode(v[k], depth + 1)
      end
      emit("}")
    end
  else
    emit("null")
  end
end

local f = assert(io.open(out_path, "w"))
local types = {}
for type_name in pairs(data.raw) do types[#types + 1] = type_name end
table.sort(types)
emit("{")
for i, type_name in ipairs(types) do
  if i > 1 then emit(",\n") end
  encode(type_name, 0)
  emit(":")
  encode(data.raw[type_name], 0)
end
emit("}\n")
f:write(table.concat(out))
f:close()
