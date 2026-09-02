import type { FastifyInstance } from "fastify";

export async function registerMainSelectionPage(app: FastifyInstance): Promise<void> {
  app.get("/select-main", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Select Main Character</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { max-width: 42rem; margin: 3rem auto; padding: 0 1rem; background: #111; color: #eee; }
    h1 { margin-bottom: .25rem; }
    .muted { color: #aaa; }
    #characters { display: grid; gap: .75rem; margin-top: 1.5rem; }
    button { width: 100%; text-align: left; padding: 1rem; border: 1px solid #444; border-radius: .5rem; background: #1d1d1d; color: inherit; cursor: pointer; }
    button:hover { background: #292929; }
    button:disabled { cursor: wait; opacity: .6; }
    .name { font-weight: 700; }
    .meta { color: #aaa; margin-top: .25rem; }
    #status { margin-top: 1rem; min-height: 1.5rem; }
  </style>
</head>
<body>
  <h1>Select your main</h1>
  <div class="muted">Choose the OH CRIT I Pulled! character you want Guild Operations to use as your current main.</div>
  <div id="characters"></div>
  <div id="status"></div>
<script>
(async () => {
  const characters = document.getElementById("characters");
  const status = document.getElementById("status");
  const meResponse = await fetch("/me");
  if (meResponse.status === 401) {
    location.href = "/auth/blizzard/start?return_to=/select-main";
    return;
  }
  if (!meResponse.ok) {
    status.textContent = "Unable to load your guild characters.";
    return;
  }
  const me = await meResponse.json();
  if (!me.guild.characters.length) {
    status.textContent = "No currently eligible guild characters were found.";
    return;
  }
  for (const character of me.guild.characters) {
    const button = document.createElement("button");
    const selected = me.guild.main_character &&
      me.guild.main_character.realm_id === character.realm_id &&
      me.guild.main_character.character_id === character.character_id;
    button.innerHTML = '<div class="name"></div><div class="meta"></div>';
    button.querySelector(".name").textContent = character.name + (selected ? " — Current main" : "");
    button.querySelector(".meta").textContent = "Realm " + character.realm_id + " · Guild rank " + character.rank;
    button.onclick = async () => {
      for (const candidate of characters.querySelectorAll("button")) candidate.disabled = true;
      status.textContent = "Saving…";
      const response = await fetch("/me/main-character", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realm_id: character.realm_id, character_id: character.character_id })
      });
      const result = await response.json();
      if (!response.ok) {
        status.textContent = result.error ?? "Unable to select main character.";
        for (const candidate of characters.querySelectorAll("button")) candidate.disabled = false;
        return;
      }
      location.reload();
    };
    characters.appendChild(button);
  }
})().catch(() => {
  document.getElementById("status").textContent = "Unable to load main character selection.";
});
</script>
</body>
</html>`);
  });
}
