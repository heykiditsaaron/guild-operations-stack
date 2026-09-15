CREATE TABLE IF NOT EXISTS guild_capability_policy_configuration (
  guild_id text NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  capability text NOT NULL,
  permitted_ranks integer[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, capability)
);

INSERT INTO guild_capability_policy_configuration (guild_id, capability, permitted_ranks)
SELECT guild_id, capability, array_agg(rank_index ORDER BY rank_index)::integer[]
  FROM guild_rank_capabilities
 WHERE capability <> 'raid.permissions'
 GROUP BY guild_id, capability
ON CONFLICT (guild_id, capability) DO NOTHING;

DELETE FROM guild_rank_capabilities
 WHERE capability = 'raid.permissions';
