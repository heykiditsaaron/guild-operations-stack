export type WebPresentationContributions = {
  meMenuSections: Array<(pathname: string) => string>;
  footerCommunityLinks: string[];
  homeCommunityActions: string[];
};

export type WebPresentationContributionProvider = (
  guildieId: string | null,
) => Promise<WebPresentationContributions>;

const providers: WebPresentationContributionProvider[] = [];

export function registerWebPresentationContributionProvider(provider: WebPresentationContributionProvider): void {
  if (providers.includes(provider)) return;
  providers.push(provider);
}

export async function webPresentationContributionsForGuildie(
  guildieId: string | null,
): Promise<WebPresentationContributions> {
  const contributions = await Promise.all(providers.map((provider) => provider(guildieId)));
  return {
    meMenuSections: contributions.flatMap((contribution) => contribution.meMenuSections),
    footerCommunityLinks: contributions.flatMap((contribution) => contribution.footerCommunityLinks),
    homeCommunityActions: contributions.flatMap((contribution) => contribution.homeCommunityActions),
  };
}
