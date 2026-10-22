# Installation public origin relocation

Guild Operations discovers and stores its public origin during initial installation. It never automatically changes the saved origin from incoming proxy headers.

The Blizzard-authoritative guild master can change the address in **Settings → General → Installation address**, provided they are already signed in at the stored origin.

If the old hostname no longer serves the installation, sign-in itself may be broken because Blizzard OAuth redirects to the saved origin. The existing installation setup authorization token can recover access without resetting the database:

1. On the deployment host, in the correct Compose project directory, read the token locally from the API container; do not print or share it.
2. Send a JSON PUT request to `/installation/public-origin` with `expected_origin` and `public_origin`, authenticating with the `x-setup-authorization` header.
3. Use a trusted local route to the API (for example, `http://127.0.0.1:3101` for a development deployment that publishes port 3101).
4. Update the registered callback URLs in Blizzard and Discord developer applications, then sign in again on the new hostname.

Example from the deployment host, using the development Compose project:

```bash
TOKEN="$(docker compose exec -T api cat /var/lib/guild-operations/setup-authorization.token)"
curl --fail-with-body --silent --show-error \
  --request PUT http://127.0.0.1:3101/installation/public-origin \
  --header 'Content-Type: application/json' \
  --header "x-setup-authorization: ${TOKEN}" \
  --data '{"expected_origin":"https://guild.gameweenies.net","public_origin":"https://dev.guild.gameweenies.net"}'
unset TOKEN
```

Adjust the port and origins for other installations. The setup token remains a sensitive installation credential. Do not paste it into chats, shell history, or logs.

This operation updates only the saved public origin; it does not change DNS, reverse proxy configuration, OAuth provider registrations, existing identities, or hostname-scoped browser cookies. Concurrent stale updates are rejected.
