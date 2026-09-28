import type { ActivitySharedValue } from "../core/activity/registry.js";
import { htmlText } from "./render.js";

function renderActivitySharedValue(value: ActivitySharedValue): string {
  const rendered = value.type === "wow_spec"
    ? htmlText(`${value.value.specName} ${value.value.className}`)
    : htmlText(String(value.value));
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
