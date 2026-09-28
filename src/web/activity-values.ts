import type { ActivitySharedValue } from "../core/activity/registry.js";
import { htmlText } from "./render.js";

function renderActivitySharedValue(value: ActivitySharedValue): string {
  const rendered = htmlText(String(value.value));
  return "unit" in value && value.unit
    ? `${rendered} ${htmlText(value.unit)}`
    : rendered;
}

export function renderActivitySharedValues(
  value: ActivitySharedValue | readonly ActivitySharedValue[],
): string {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => renderActivitySharedValue(item)).join(", ");
}
