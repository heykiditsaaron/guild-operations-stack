import { getSpecDefinition } from "./registry.js";
import type { CoordinationGoal, CoordinationOffer, GoalCoverage } from "./types.js";

export function evaluateGoalCoverage(
  goals: readonly CoordinationGoal[],
  assignedOffers: readonly CoordinationOffer[],
): GoalCoverage[] {
  return goals.map((goal) => {
    const current = assignedOffers.reduce((count, offer) => {
      if (!offer.className || !offer.specName) return count;
      const definition = getSpecDefinition(offer.className, offer.specName);
      return definition?.tags.includes(goal.tag) ? count + 1 : count;
    }, 0);

    return {
      goalId: goal.goalId,
      tag: goal.tag,
      minimum: goal.minimum,
      current,
      met: current >= goal.minimum,
    };
  });
}
