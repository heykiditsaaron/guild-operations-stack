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
    body { max-width: 46rem; margin: 3rem auto; padding: 0 1rem; background: #111; color: #eee; }
    h1 { margin-bottom: .25rem; }
    .muted { color: #aaa; }
    #characters { display: grid; gap: .75rem; margin-top: 1.5rem; }
    button { width: 100%; text-align: left; padding: .75rem; border: 1px solid #444; border-radius: .5rem; background: #1d1d1d; color: inherit; cursor: pointer; }
    button:hover { background: #292929; }
    button:disabled { cursor: wait; opacity: .6; }
    .character { display: flex; align-items: center; gap: 1rem; }
    .portrait { width: 64px; height: 64px; flex: 0 0 64px; border-radius: .35rem; object-fit: cover; background: #292929; }
    .details { min-width: 0; }
    .name { font-weight: 700; font-size: 1.05rem; }
    .meta { color: #aaa; margin-top: .2rem; }
    .submeta { color: #888; margin-top: .15rem; font-size: .9rem; }
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
    const row = document.createElement("div");
    const details = document.createElement("div");
    const name = document.createElement("div");
    const meta = document.createElement("div");
    const submeta = document.createElement("div");
    const selected = me.guild.main_character &&
      me.guild.main_character.realm_id === character.realm_id &&
      me.guild.main_character.character_id === character.character_id;

    row.className = "character";
    details.className = "details";
    name.className = "name";
    meta.className = "meta";
    submeta.className = "submeta";

    if (character.avatar_url) {
      const portrait = document.createElement("img");
      portrait.className = "portrait";
      portrait.src = character.avatar_url;
      portrait.alt = "";
      row.appendChild(portrait);
    } else {
      const portrait = document.createElement("div");
      portrait.className = "portrait";
      row.appendChild(portrait);
    }

    name.textContent = character.name + (selected ? " — Current main" : "");

    const identity = [];
    if (character.level != null) identity.push("Level " + character.level);
    if (character.active_spec_name && character.class_name) identity.push(character.active_spec_name + " " + character.class_name);
    else if (character.class_name) identity.push(character.class_name);
    else if (character.race_name) identity.push(character.race_name);
    meta.textContent = identity.length ? identity.join(" · ") : "Character profile not enriched yet";

    const location = character.realm_name || ("Realm " + character.realm_id);
    submeta.textContent = location + " · Guild rank " + character.rank;

    details.appendChild(name);
    details.appendChild(meta);
    details.appendChild(submeta);
    row.appendChild(details);
    button.appendChild(row);

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
