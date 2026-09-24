CREATE TABLE installation_web_configuration (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  public_origin text NOT NULL,
  established_at timestamptz NOT NULL DEFAULT now()
);
