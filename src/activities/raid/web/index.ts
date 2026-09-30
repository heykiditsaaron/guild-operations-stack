import type { FastifyInstance } from "fastify";
import { authenticatedIdentity, SESSION_COOKIE_NAME } from "../../../auth.js";
import { raidEventFacts, raidOccurrenceDestinations, establishRaidSignup, revokeRaidSignup } from "../application.js";
import { raidParticipationCharacters, raidSignupsForGuildie, type RaidParticipationCharacter, type RaidSignupView } from "../participation-view.js";
import type { RaidDifficulty, RaidOfferedSpecInput, RaidRole } from "../domain.js";
import { specializationIconUrl } from "../../../wow-iconography.js";
import { allWowClassTraitDefinitions, specsForClass } from "../../../wow-traits/registry.js";
import type { AssetRegistry } from "../../../web/assets.js";
import { htmlText, renderOccurrenceParticipation, renderPage } from "../../../web/render.js";
import { viewerForRequest } from "../../../web/viewer.js";

type RaidParams = { raidId: string };
type WithdrawParams = RaidParams & { signupRowId: string };
type SignupBody = { offeredSpecs?: unknown };

function roleLabel(role: RaidRole): string { return role === "damage" ? "Damage" : role === "healer" ? "Healer" : "Tank"; }
function difficultyLabel(value: RaidDifficulty): string { return value[0].toUpperCase() + value.slice(1); }
function localTime(unixSeconds:number):string{const instant=new Date(unixSeconds*1000).toISOString();return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="full">${instant}</time>`;}

function ownSignupsView(rows:readonly RaidSignupView[],canWithdraw:boolean):string{
  return rows.length?`<section class="raid-my-offers"><h2>Your participation</h2><div>${rows.map(row=>`<article><strong>${htmlText(row.displayName)}</strong><span>Willing to play: ${row.offeredSpecs.map(spec=>htmlText(`${spec.specName} ${spec.className}`)).join(", ")}</span>${row.assignmentId!==null?`<span>Assigned: ${htmlText(row.selectedSpec??"")} ${htmlText(row.selectedClass??"")} · ${htmlText(roleLabel(row.selectedRole!))}</span>`:""}${canWithdraw?`<button type="button" class="button-secondary" data-raid-revoke-signup="${htmlText(row.signupRowId)}">Withdraw</button>`:""}</article>`).join("")}</div></section>`:"";
}

async function participationEditor(
  characters: RaidParticipationCharacter[],
  allowDeclaredClasses: boolean,
  existing: RaidSignupView | null,
): Promise<string> {
  const existingSpecs = new Set((existing?.offeredSpecs ?? []).map((spec) => `${spec.className}\u0000${spec.specName}`));
  const knownClasses = [...new Set(characters.map((character) => character.className))];
  const classes = allWowClassTraitDefinitions().map((definition) => definition.className);
  const characterChoices = characters.map((character, index) =>
    `<label class="raid-pool-choice"><input type="checkbox" name="pool-character" value="${index}" data-class-name="${htmlText(character.className)}" data-region="${htmlText(character.region)}" data-realm-id="${htmlText(character.realmId)}" data-character-id="${htmlText(character.characterId)}"><span><strong>${htmlText(character.name)}</strong><small>${htmlText(character.className)}${character.realmName ? ` · ${htmlText(character.realmName)}` : ""}</small></span></label>`
  ).join("");
  const declaredChoices = allowDeclaredClasses ? classes.map((className) =>
    `<label class="raid-pool-choice"><input type="checkbox" name="pool-class" value="${htmlText(className)}"><span><strong>${htmlText(className)}</strong><small>Declare class</small></span></label>`
  ).join("") : "";
  const specs = await Promise.all(classes.flatMap((className) =>
    specsForClass(className).map(async (specName) => {
      const icon = await specializationIconUrl(className, specName);
      return `<label class="raid-spec-choice" data-raid-spec-choice data-class-name="${htmlText(className)}" hidden><input type="checkbox" name="spec" value="${htmlText(specName)}" data-class-name="${htmlText(className)}"${existingSpecs.has(`${className}\u0000${specName}`) ? " checked" : ""}>${icon ? `<img src="${htmlText(icon)}" alt="" loading="lazy">` : ""}<span>${htmlText(specName)} ${htmlText(className)}</span></label>`;
    })
  ));
  const sourceHint = allowDeclaredClasses
    ? "Choose any characters you want to bring into the pool, or declare classes directly. You can choose more than one."
    : "Choose the characters you are willing to bring into the pool. You can choose more than one.";
  return `<section class="raid-participation participation-workspace" aria-labelledby="raid-signup-heading">
    <div class="participation-workspace-header">
      <h2 id="raid-signup-heading">${existing ? "Revise your offer" : "Sign up"}</h2>
      <p>Build the pool first. Guild Operations will use it to show the specializations you can offer; you still choose which of those you are willing to play.</p>
    </div>
    <form class="raid-offer-form" data-raid-signup-form>
      <fieldset data-raid-class-pool>
        <legend>1. What are you willing to bring?</legend>
        <p>${sourceHint}</p>
        ${characters.length ? `<div class="raid-pool-section"><h3>Your characters</h3><div class="raid-pool-choices">${characterChoices}</div></div>` : ""}
        ${allowDeclaredClasses ? `<div class="raid-pool-section"><h3>Classes</h3><div class="raid-pool-choices">${declaredChoices}</div></div>` : ""}
      </fieldset>
      <fieldset data-raid-specs>
        <legend>2. Which specializations are you willing to play?</legend>
        <p data-raid-specs-empty>Choose at least one character${allowDeclaredClasses ? " or class" : ""} above to see specializations.</p>
        <div class="raid-spec-choices" data-raid-spec-choices>${specs.join("")}</div>
      </fieldset>
      <button type="submit" class="button-primary">${existing ? "Update offer" : "Sign up"}</button>
      <p data-raid-signup-status role="status" aria-live="polite"></p>
    </form>
  </section>`;
}
function offeredSpecInput(value:unknown):RaidOfferedSpecInput|null{
  if(!value||typeof value!=="object")return null;
  const item=value as Record<string,unknown>;
  if(typeof item.specName!=="string"||!item.specName.trim())return null;
  const character=item.character;
  if(character&&typeof character==="object"){
    const coordinate=character as Record<string,unknown>;
    if(typeof coordinate.region!=="string"||typeof coordinate.realmId!=="string"||typeof coordinate.characterId!=="string")return null;
    return {character:{region:coordinate.region,realmId:coordinate.realmId,characterId:coordinate.characterId},specName:item.specName.trim()};
  }
  if(typeof item.className!=="string"||!item.className.trim())return null;
  return {className:item.className.trim(),specName:item.specName.trim()};
}

export async function registerRaidParticipationRoutes(app:FastifyInstance,assets:AssetRegistry):Promise<void>{
  app.get<{Params:RaidParams}>("/activities/raid/:raidId/participation",async(request,reply)=>{const sessionToken=request.cookies[SESSION_COOKIE_NAME];const [viewer,guildie,raid]=await Promise.all([viewerForRequest(sessionToken),authenticatedIdentity(sessionToken),raidEventFacts(request.params.raidId)]);if(!raid)return reply.code(404).send({error:"Raid not found"});const historical=raid.concludedAtUnix!==null,signupsOpen=!historical,publicDestination=raidOccurrenceDestinations(raid.raidId).find(value=>value.kind==="public");let intake="",ownRows="";let existing:RaidSignupView|null=null;if(guildie){try{const rows=await raidSignupsForGuildie(raid.raidId,guildie.guildieId);existing=rows.find(row=>row.withdrawnAtUnix===null&&row.deniedAtUnix===null)??null;ownRows=ownSignupsView(rows,signupsOpen);}catch{ownRows="";}}
    if(historical){intake=`<section class="raid-signup-state"><h2>Raid record</h2><p>This raid is concluded. Its commitments, assignments, adjudications, and established Participation are preserved as history.</p></section>`;}else if(!guildie){intake=`<section class="raid-signup-state"><h2>Sign in to participate</h2><p>This web signup surface currently accepts Guild Operations members. External intake will use its own producer when that integration exists.</p></section>`;}else{try{const {characters}=await raidParticipationCharacters(raid.raidId,guildie.guildieId);const allowDeclaredClasses=raid.eligibility==="anyone";intake=characters.length||allowDeclaredClasses?await participationEditor(characters,allowDeclaredClasses,existing):`<section class="raid-signup-state"><h2>No eligible characters</h2><p>No currently controlled character is eligible for this raid.</p></section>`;}catch(error){intake=`<section class="raid-signup-state"><h2>Not eligible</h2><p>${htmlText(error instanceof Error?error.message:"You are not eligible to participate in this raid.")}</p></section>`;}}
    const html=renderPage(assets,{pathname:request.url,title:`Participation · ${raid.label} · ${viewer.guildPresentation.guildName} Guild Operations`,description:`Participation for ${raid.label}.`,viewer,stylesheets:["raid.css"],scripts:["raid.js"],secondaryNavigation:publicDestination?{kind:"back",label:raid.label,href:publicDestination.href}:{kind:"back",label:"Activities",href:"/activities"},header:"",body:renderOccurrenceParticipation({activity:"Raid",title:raid.label,context:`${localTime(raid.occursAt[0])} · ${htmlText(difficultyLabel(raid.difficulty))}${historical?" · Historical":""}`,existingParticipation:ownRows||undefined,intake})});return reply.header("Cache-Control","no-cache").type("text/html; charset=utf-8").send(html);});

  app.post<{Params:RaidParams;Body:SignupBody}>("/activities/raid/:raidId/signup",async(request,reply)=>{const guildie=await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);if(!guildie)return reply.code(401).send({error:"Authentication required"});const raw=request.body?.offeredSpecs;if(!Array.isArray(raw)||!raw.length)return reply.code(400).send({error:"At least one specialization is required"});const offeredSpecs=raw.map(offeredSpecInput);if(offeredSpecs.some(value=>value===null))return reply.code(400).send({error:"Specialization offer is invalid"});try{const signupRowId=await establishRaidSignup({raidId:request.params.raidId,applicantAnchor:{kind:"guildie",value:guildie.guildieId},offeredSpecs:offeredSpecs as RaidOfferedSpecInput[]});return reply.code(201).send({signupRowId});}catch(error){return reply.code(400).send({error:error instanceof Error?error.message:"Signup could not be submitted"});}});
  app.post<{Params:WithdrawParams}>("/activities/raid/:raidId/signup/:signupRowId/withdraw",async(request,reply)=>{const guildie=await authenticatedIdentity(request.cookies[SESSION_COOKIE_NAME]);if(!guildie)return reply.code(401).send({error:"Authentication required"});try{await revokeRaidSignup({raidId:request.params.raidId,signupRowId:request.params.signupRowId,applicantAnchor:{kind:"guildie",value:guildie.guildieId}});return reply.code(204).send();}catch(error){return reply.code(400).send({error:error instanceof Error?error.message:"Signup could not be withdrawn"});}});
}
