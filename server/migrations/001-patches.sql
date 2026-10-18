CREATE TABLE IF NOT EXISTS patch_assets (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    hash TEXT NOT NULL CHECK(length(hash) = 64 AND hash NOT GLOB '*[^a-f0-9]*'),
    png BLOB NOT NULL CHECK(length(png) <= 307200),
    created_at INTEGER NOT NULL,
    PRIMARY KEY(account_id, hash)
);
