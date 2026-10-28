# Host rebinding

Rebinding changes the installation's Blizzard guild identity. A rename or an unchanged guild identity is not a rebind. Reset and reinstall are separate lifecycle operations.

From the installation directory, initiate the host procedure:

```sh
docker compose run --rm -it api node dist/host-command.js rebind
```

The command displays the current guild and instructs the host operator to manually review or edit `GUILD_REGION`, `GUILD_REALM`, and `GUILD_NAME` in the host `.env`. It never edits the file. After saving it, use a **new Compose invocation** so the command receives the updated environment:

```sh
docker compose run --rm -it api node dist/host-command.js rebind confirm
```

Confirming validates the configured guild against Blizzard and compares its identity with the current binding. An unchanged guild identity creates no request. Otherwise the operator acknowledges the reviewed configuration and types the destination guild name to create a durable pending request. The active binding is unchanged until the destination Guild Master authorizes in the browser with fresh Blizzard authentication.

To cancel a pending request:

```sh
docker compose run --rm -it api node dist/host-command.js rebind cancel
```

Only one request may be pending. Successful authorization resets guild-owned permissions and integrations, refreshes the destination roster, and records the transition. Identities and historical records remain. External messages and actions from the previous binding may persist on provider systems but are no longer managed; cleanup is best effort, not guaranteed.

Do not run rebinding against production until runtime validation is complete.
