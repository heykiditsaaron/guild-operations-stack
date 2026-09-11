export type ApplicantEligibility = "guild_character" | "guildie" | "anyone";
export type CoordinationRole = "tank" | "healer" | "damage";

export type CoordinationApplicantSource = "guild_character" | "guildie" | "external";

export type CoordinationApplicant = {
  applicantId: string;
  coordinationId: string;
  source: CoordinationApplicantSource;
  guildieId: string | null;
  characterRecordId: string | null;
  externalLabel: string | null;
};

export type CoordinationOpportunity = {
  opportunityId: string;
  coordinationId: string;
  key: string;
  label: string;
  requiredRole: CoordinationRole | null;
  quantity: number | null;
};

export type CoordinationGoal = {
  goalId: string;
  coordinationId: string;
  tag: string;
  minimum: number;
};

export type CoordinationOffer = {
  offerId: string;
  coordinationId: string;
  applicantId: string;
  characterRecordId: string | null;
  className: string | null;
  specName: string | null;
  payload: Record<string, unknown>;
  withdrawnAtUnix: number | null;
};

export type CoordinationAssignment = {
  assignmentId: string;
  coordinationId: string;
  offerId: string;
  opportunityId: string;
  assignedByGuildieId: string;
  assignedAtUnix: number;
  releasedAtUnix: number | null;
};

export type GoalCoverage = {
  goalId: string;
  tag: string;
  minimum: number;
  current: number;
  met: boolean;
};
