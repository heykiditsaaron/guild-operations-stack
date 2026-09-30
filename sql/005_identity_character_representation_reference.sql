ALTER TABLE identity_character_representations
  ADD COLUMN character_record_id uuid;

UPDATE identity_character_representations representation
SET character_record_id = character.character_record_id
FROM character_roster character
WHERE character.region = representation.region
  AND character.realm_id = representation.realm_id
  AND character.character_id = representation.character_id;

ALTER TABLE identity_character_representations
  ALTER COLUMN character_record_id SET NOT NULL,
  ADD CONSTRAINT identity_character_representations_character_record_id_fkey
    FOREIGN KEY (character_record_id)
    REFERENCES character_roster(character_record_id)
    ON DELETE RESTRICT,
  DROP COLUMN region,
  DROP COLUMN realm_id,
  DROP COLUMN character_id;
