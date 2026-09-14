CREATE TABLE IF NOT EXISTS guild_module_enablement (
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL,
  updated_at_unix bigint NOT NULL DEFAULT (extract(epoch FROM now())::bigint),
  PRIMARY KEY (guild_id, module_key)
);

INSERT INTO guild_module_enablement (guild_id, module_key, enabled)
SELECT guild_id, 'raffle', true
  FROM guilds
ON CONFLICT (guild_id, module_key) DO NOTHING;

INSERT INTO guild_module_enablement (guild_id, module_key, enabled)
SELECT guild_id, 'raid', true
  FROM guilds
ON CONFLICT (guild_id, module_key) DO NOTHING;

INSERT INTO guild_module_enablement (guild_id, module_key, enabled)
SELECT guild_id, 'discord', enabled
  FROM discord_module_settings
ON CONFLICT (guild_id, module_key) DO NOTHING;

INSERT INTO guild_module_enablement (guild_id, module_key, enabled)
SELECT guild_id, 'discord', false
  FROM guilds
ON CONFLICT (guild_id, module_key) DO NOTHING;

INSERT INTO guild_rank_capabilities (guild_id, rank_index, capability)
SELECT guild_id, rank_index, 'modules.configure'
  FROM guild_rank_definitions
 WHERE rank_index = 0
ON CONFLICT (guild_id, rank_index, capability) DO NOTHING;
