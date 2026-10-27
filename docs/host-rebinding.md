# Host rebinding

The host operator creates a one-time request; the destination Guild Master authorizes it through the browser. The active guild remains unchanged until authorization succeeds.

Run from the installation directory with the usual Compose environment:

```sh
docker compose run --rm -it api node dist/host-command.js rebind us area-52 "Example Guild"
```

Review the current and destination guild and type the destination guild name to confirm. Only one request may be pending. A request survives restarts and does not modify the active guild.

To cancel a pending request without changing the binding:

```sh
docker compose run --rm -it api node dist/host-command.js rebind cancel
```

After host confirmation, the destination Guild Master signs in with Blizzard and authorizes on the installation setup page. Successful authorization refreshes the destination roster from Blizzard, resets guild-owned capability policies and Discord configuration, records the transition, and consumes the request. Identities and history remain.

The `GUILD_REBIND` environment flag is obsolete. Do not run rebinding against production until the release has passed runtime validation.
