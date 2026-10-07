PRAGMA foreign_keys = OFF;

ALTER TABLE script_blocks RENAME TO script_blocks_old;

CREATE TABLE script_blocks (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    type TEXT NOT NULL,
    character_id TEXT,
    content TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES script_scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES script_characters(id) ON DELETE RESTRICT,
    CHECK (type IN ('dialogue', 'direction', 'sound', 'lighting'))
);

INSERT INTO script_blocks (
    id,
    scene_id,
    type,
    character_id,
    content,
    sort_order,
    created_at,
    updated_at
)
SELECT
    id,
    scene_id,
    type,
    character_id,
    content,
    sort_order,
    created_at,
    updated_at
FROM script_blocks_old;

DROP TABLE script_blocks_old;

CREATE INDEX idx_script_blocks_scene_id ON script_blocks(scene_id);
CREATE INDEX idx_script_blocks_character_id ON script_blocks(character_id);
CREATE INDEX idx_script_blocks_sort_order ON script_blocks(scene_id, sort_order);

PRAGMA foreign_keys = ON;
