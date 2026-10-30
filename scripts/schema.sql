-- One database per dataset. Mirrors src/db/types.ts; see docs/data-model.md.
-- Lists that are queried (recipe ingredients, results, categories) get their own tables;
-- small nested values are stored as JSON text.

CREATE TABLE game (name TEXT NOT NULL, version TEXT NOT NULL, mods TEXT NOT NULL, source TEXT NOT NULL);

CREATE TABLE item_group (id TEXT PRIMARY KEY, name TEXT NOT NULL, "order" TEXT NOT NULL);
CREATE TABLE item_subgroup (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES item_group (id),
  "order" TEXT NOT NULL
);

CREATE TABLE item (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subgroup TEXT NOT NULL REFERENCES item_subgroup (id),
  "order" TEXT NOT NULL,
  stack_size INTEGER NOT NULL,
  fuel_category TEXT,
  fuel_value REAL,
  burnt_result TEXT REFERENCES item (id),
  spoil_time REAL,
  spoil_result TEXT REFERENCES item (id)
);

CREATE TABLE fluid (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subgroup TEXT NOT NULL REFERENCES item_subgroup (id),
  "order" TEXT NOT NULL,
  default_temperature REAL NOT NULL,
  fuel_value REAL
);

CREATE TABLE recipe (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  time REAL NOT NULL,
  main_product TEXT,
  subgroup TEXT REFERENCES item_subgroup (id),
  "order" TEXT NOT NULL,
  hidden INTEGER NOT NULL,
  allowed_effects TEXT NOT NULL,
  max_productivity REAL NOT NULL,
  surface_conditions TEXT
);
CREATE TABLE recipe_category (
  recipe TEXT NOT NULL REFERENCES recipe (id),
  category TEXT NOT NULL,
  PRIMARY KEY (recipe, category)
);
CREATE TABLE recipe_ingredient (
  recipe TEXT NOT NULL REFERENCES recipe (id),
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  id TEXT NOT NULL,
  amount REAL NOT NULL,
  PRIMARY KEY (recipe, position)
);
CREATE TABLE recipe_result (
  recipe TEXT NOT NULL REFERENCES recipe (id),
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  id TEXT NOT NULL,
  amount REAL,
  amount_min REAL,
  amount_max REAL,
  probability REAL,
  extra_fraction REAL,
  ignored_by_productivity REAL,
  PRIMARY KEY (recipe, position)
);
CREATE INDEX recipe_result_by_id ON recipe_result (id);
CREATE INDEX recipe_ingredient_by_id ON recipe_ingredient (id);

CREATE TABLE machine (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  speed REAL NOT NULL,
  energy TEXT NOT NULL,
  module_slots INTEGER NOT NULL,
  allowed_effects TEXT NOT NULL,
  base_effect TEXT,
  surface_conditions TEXT,
  boiler TEXT
);
CREATE TABLE machine_category (
  machine TEXT NOT NULL REFERENCES machine (id),
  category TEXT NOT NULL,
  PRIMARY KEY (machine, category)
);

CREATE TABLE resource (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  mining_time REAL NOT NULL,
  results TEXT NOT NULL,
  required_fluid TEXT,
  infinite INTEGER NOT NULL
);

CREATE TABLE module (
  id TEXT PRIMARY KEY REFERENCES item (id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  tier INTEGER NOT NULL,
  effects TEXT NOT NULL
);

CREATE TABLE beacon (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  distribution_effectivity REAL NOT NULL,
  distribution_effectivity_per_quality REAL NOT NULL,
  profile TEXT NOT NULL,
  module_slots INTEGER NOT NULL,
  power REAL NOT NULL,
  allowed_effects TEXT NOT NULL
);

CREATE TABLE belt (id TEXT PRIMARY KEY, name TEXT NOT NULL, speed REAL NOT NULL);

CREATE TABLE planet (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  surface_properties TEXT NOT NULL,
  resources TEXT NOT NULL,
  fluids TEXT NOT NULL,
  gathered TEXT NOT NULL
);

CREATE TABLE surface_property (id TEXT PRIMARY KEY, name TEXT NOT NULL, default_value REAL NOT NULL);

CREATE TABLE quality (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  next TEXT,
  next_probability REAL,
  chain_probability REAL,
  beacon_power_multiplier REAL
);

CREATE TABLE research (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  recipes TEXT NOT NULL,
  change REAL NOT NULL,
  max_level INTEGER
);

-- Icon positions in the dataset's sprite atlas (icons.webp). Keys are "<kind>/<id>",
-- e.g. "item/iron-plate"; kinds are item, fluid, recipe, machine and planet.
CREATE TABLE icon_atlas (size INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL);
CREATE TABLE icon (key TEXT PRIMARY KEY, x INTEGER NOT NULL, y INTEGER NOT NULL);
