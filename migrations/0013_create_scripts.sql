PRAGMA foreign_keys = ON;

CREATE TABLE scripts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_scripts_created_by
    ON scripts(created_by);

CREATE INDEX idx_scripts_updated_at
    ON scripts(updated_at);


CREATE TABLE script_acts (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (script_id)
        REFERENCES scripts(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_script_acts_script_id
    ON script_acts(script_id);

CREATE INDEX idx_script_acts_sort_order
    ON script_acts(script_id, sort_order);


CREATE TABLE script_scenes (
    id TEXT PRIMARY KEY,
    act_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (act_id)
        REFERENCES script_acts(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_script_scenes_act_id
    ON script_scenes(act_id);

CREATE INDEX idx_script_scenes_sort_order
    ON script_scenes(act_id, sort_order);


CREATE TABLE script_characters (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (script_id)
        REFERENCES scripts(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_script_characters_script_id
    ON script_characters(script_id);

CREATE INDEX idx_script_characters_sort_order
    ON script_characters(script_id, sort_order);


CREATE TABLE script_casts (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cast_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (character_id, user_id),

    FOREIGN KEY (character_id)
        REFERENCES script_characters(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_script_casts_character_id
    ON script_casts(character_id);

CREATE INDEX idx_script_casts_user_id
    ON script_casts(user_id);

CREATE INDEX idx_script_casts_cast_order
    ON script_casts(character_id, cast_order);


CREATE TABLE script_scene_characters (
    scene_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (scene_id, character_id),

    FOREIGN KEY (scene_id)
        REFERENCES script_scenes(id)
        ON DELETE CASCADE,

    FOREIGN KEY (character_id)
        REFERENCES script_characters(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_script_scene_characters_character_id
    ON script_scene_characters(character_id);


CREATE TABLE script_blocks (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    type TEXT NOT NULL,
    character_id TEXT,
    content TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (scene_id)
        REFERENCES script_scenes(id)
        ON DELETE CASCADE,

    FOREIGN KEY (character_id)
        REFERENCES script_characters(id)
        ON DELETE RESTRICT,

    CHECK (type IN ('dialogue', 'direction'))
);

CREATE INDEX idx_script_blocks_scene_id
    ON script_blocks(scene_id);

CREATE INDEX idx_script_blocks_character_id
    ON script_blocks(character_id);

CREATE INDEX idx_script_blocks_sort_order
    ON script_blocks(scene_id, sort_order);


CREATE TABLE script_versions (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    name TEXT,
    note TEXT,
    snapshot_json TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (script_id, version_number),

    FOREIGN KEY (script_id)
        REFERENCES scripts(id)
        ON DELETE CASCADE,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_script_versions_script_id
    ON script_versions(script_id);

CREATE INDEX idx_script_versions_created_at
    ON script_versions(script_id, created_at);
