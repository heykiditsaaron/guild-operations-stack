export type ModuleWebPresentation = {
  meMenuSections: Array<(pathname: string) => string>;
  footerCommunityLinks: string[];
  homeCommunityActions: string[];
};

export type ModuleWebPresentationProvider = (
  guildieId: string | null,
) => Promise<ModuleWebPresentation>;

const providers: ModuleWebPresentationProvider[] = [];

export function registerModuleWebPresentationProvider(provider: ModuleWebPresentationProvider): void {
  if (providers.includes(provider)) return;
  providers.push(provider);
}

export async function moduleWebPresentationForGuildie(
  guildieId: string | null,
): Promise<ModuleWebPresentation> {
  const contributions = await Promise.all(providers.map((provider) => provider(guildieId)));
  return {
    meMenuSections: contributions.flatMap((contribution) => contribution.meMenuSections),
    footerCommunityLinks: contributions.flatMap((contribution) => contribution.footerCommunityLinks),
    homeCommunityActions: contributions.flatMap((contribution) => contribution.homeCommunityActions),
  };
}
