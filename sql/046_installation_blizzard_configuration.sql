CREATE TABLE installation_blizzard_configuration (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  client_id text NOT NULL,
  client_secret_ciphertext text NOT NULL,
  configured_at timestamptz NOT NULL DEFAULT now()
);
