# Relocating the installation public origin

The public origin is host-owned configuration. Guild Operations reads `PUBLIC_ORIGIN` (or `PUBLIC_ORIGIN_FILE`) from the deployment environment. It does not infer the origin from reverse-proxy headers or let guild operators modify it through Guild Settings.

To relocate an installation:

1. Preserve the existing PostgreSQL data, installation encryption key, and host-managed credentials. Do not recreate named volumes or reinitialize the guild.
2. Configure DNS, reverse proxy, and TLS for the new address.
3. Register the new OAuth callback URL with the existing Blizzard application. Update the Discord application's OAuth redirect URLs as appropriate. Preserve application identities and credentials unless intentionally rotating them.
4. Change `PUBLIC_ORIGIN` in the host deployment configuration (or the contents of the file designated by `PUBLIC_ORIGIN_FILE`).
5. Recreate the affected application containers using the **same Compose topology and secret overlays** as the existing deployment. For a typical bundled deployment, `docker compose up -d --force-recreate api discord` is sufficient after updating `.env`; add the same `-f` options used for the original installation.
6. Visit the new address and verify Blizzard sign-in, guild authorization, and any configured Discord OAuth integration.

Browser cookies are scoped to their original hostname, so users may need to sign in again. If sign-in fails, verify that the host-configured public origin and Blizzard callback registration match exactly.

This operation does **not** modify the database-stored guild binding or replace the installation encryption key. The former setup-authorization-token recovery procedure and browser `/installation/public-origin` update endpoint are obsolete; do not use them.
