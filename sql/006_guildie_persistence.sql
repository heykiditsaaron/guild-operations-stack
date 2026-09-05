-- Correct the original persisted "Subject" model to its earned domain object: Guildie.
-- Subject is contextual language, not a persisted entity category. This migration
-- intentionally leaves no compatibility table, view, or column named Subject.

DO $$
BEGIN
  IF to_regclass('public.guild_subjects') IS NOT NULL
     AND to_regclass('public.guildies') IS NULL THEN
    ALTER TABLE guild_subjects RENAME TO guildies;
  END IF;
END $$;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('guildies', 'subject_id', 'guildie_id'),
      ('blizzard_principals', 'subject_id', 'guildie_id'),
      ('wow_accounts', 'subject_id', 'guildie_id'),
      ('characters', 'subject_id', 'guildie_id'),
      ('authentication_attempts', 'subject_id', 'guildie_id'),
      ('application_sessions', 'subject_id', 'guildie_id'),
      ('discord_association_attempts', 'subject_id', 'guildie_id'),
      ('discord_associations', 'subject_id', 'guildie_id'),
      ('subject_main_characters', 'subject_id', 'guildie_id'),
      ('raffle_rounds', 'created_by_subject_id', 'created_by_guildie_id'),
      ('raffle_rounds', 'updated_by_subject_id', 'updated_by_guildie_id'),
      ('raffle_rounds', 'live_by_subject_id', 'live_by_guildie_id'),
      ('raffle_rounds', 'concluded_by_subject_id', 'concluded_by_guildie_id'),
      ('raffle_claims', 'subject_id', 'claimant_guildie_id'),
      ('raffle_claims', 'approved_by_subject_id', 'approved_by_guildie_id'),
      ('raffle_claims', 'denied_by_subject_id', 'denied_by_guildie_id'),
      ('raffle_claims', 'cancelled_by_subject_id', 'cancelled_by_guildie_id')
    ) AS changes(table_name, old_column, new_column)
  LOOP
    IF to_regclass('public.' || item.table_name) IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = item.table_name
            AND column_name = item.old_column
       )
       AND NOT EXISTS (
         SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = item.table_name
            AND column_name = item.new_column
       ) THEN
      EXECUTE format(
        'ALTER TABLE %I RENAME COLUMN %I TO %I',
        item.table_name,
        item.old_column,
        item.new_column
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.subject_main_characters') IS NOT NULL
     AND to_regclass('public.guildie_main_characters') IS NULL THEN
    ALTER TABLE subject_main_characters RENAME TO guildie_main_characters;
  END IF;
END $$;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('guildies', 'guild_subjects_pkey', 'guildies_pkey'),
      ('blizzard_principals', 'blizzard_principals_subject_id_fkey', 'blizzard_principals_guildie_id_fkey'),
      ('wow_accounts', 'wow_accounts_subject_id_fkey', 'wow_accounts_guildie_id_fkey'),
      ('characters', 'characters_subject_id_fkey', 'characters_guildie_id_fkey'),
      ('guildie_main_characters', 'subject_main_characters_pkey', 'guildie_main_characters_pkey'),
      ('guildie_main_characters', 'subject_main_characters_subject_id_fkey', 'guildie_main_characters_guildie_id_fkey'),
      ('authentication_attempts', 'authentication_attempts_subject_id_fkey', 'authentication_attempts_guildie_id_fkey'),
      ('application_sessions', 'application_sessions_subject_id_fkey', 'application_sessions_guildie_id_fkey'),
      ('discord_association_attempts', 'discord_association_attempts_subject_id_fkey', 'discord_association_attempts_guildie_id_fkey'),
      ('discord_associations', 'discord_associations_subject_id_fkey', 'discord_associations_guildie_id_fkey'),
      ('raffle_rounds', 'raffle_rounds_created_by_subject_id_fkey', 'raffle_rounds_created_by_guildie_id_fkey'),
      ('raffle_rounds', 'raffle_rounds_updated_by_subject_id_fkey', 'raffle_rounds_updated_by_guildie_id_fkey'),
      ('raffle_rounds', 'raffle_rounds_live_by_subject_id_fkey', 'raffle_rounds_live_by_guildie_id_fkey'),
      ('raffle_rounds', 'raffle_rounds_concluded_by_subject_id_fkey', 'raffle_rounds_concluded_by_guildie_id_fkey'),
      ('raffle_claims', 'raffle_claims_subject_id_fkey', 'raffle_claims_claimant_guildie_id_fkey'),
      ('raffle_claims', 'raffle_claims_approved_by_subject_id_fkey', 'raffle_claims_approved_by_guildie_id_fkey'),
      ('raffle_claims', 'raffle_claims_denied_by_subject_id_fkey', 'raffle_claims_denied_by_guildie_id_fkey'),
      ('raffle_claims', 'raffle_claims_cancelled_by_subject_id_fkey', 'raffle_claims_cancelled_by_guildie_id_fkey')
    ) AS changes(table_name, old_name, new_name)
  LOOP
    IF to_regclass('public.' || item.table_name) IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM pg_constraint
          WHERE conrelid = to_regclass('public.' || item.table_name)
            AND conname = item.old_name
       )
       AND NOT EXISTS (
         SELECT 1
           FROM pg_constraint
          WHERE conrelid = to_regclass('public.' || item.table_name)
            AND conname = item.new_name
       ) THEN
      EXECUTE format(
        'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
        item.table_name,
        item.old_name,
        item.new_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.application_sessions_subject_id_idx') IS NOT NULL
     AND to_regclass('public.application_sessions_guildie_id_idx') IS NULL THEN
    ALTER INDEX application_sessions_subject_id_idx RENAME TO application_sessions_guildie_id_idx;
  END IF;

  IF to_regclass('public.characters_subject_id_idx') IS NOT NULL
     AND to_regclass('public.characters_guildie_id_idx') IS NULL THEN
    ALTER INDEX characters_subject_id_idx RENAME TO characters_guildie_id_idx;
  END IF;

  IF to_regclass('public.raffle_claims_subject_idx') IS NOT NULL
     AND to_regclass('public.raffle_claims_claimant_guildie_idx') IS NULL THEN
    ALTER INDEX raffle_claims_subject_idx RENAME TO raffle_claims_claimant_guildie_idx;
  END IF;
END $$;
