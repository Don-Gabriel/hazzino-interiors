const units = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  inch: 25.4,
  inches: 25.4,
  ft: 304.8,
  feet: 304.8,
  '"': 25.4,
  "'": 304.8,
};
function numeric(text) {
  const match = text.trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (match) return Number(match[1] || 0) + Number(match[2]) / Number(match[3]);
  return /^\d*\.?\d+$/.test(text.trim()) ? Number(text) : NaN;
}
export function parseDistance(value, defaultUnit = "mm") {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw Error("Enter a valid distance");
    return value * (units[defaultUnit] || 1);
  }
  let input = String(value)
    .trim()
    .toLowerCase()
    .replace(/[′’]/g, "'")
    .replace(/[″“”]/g, '"');
  const sign = input.startsWith("-") ? -1 : 1;
  input = input.replace(/^[+-]\s*/, "");
  let result;
  const feet = input.match(/^(.+?)\s*(?:'|ft)\s*(.*?)\s*(?:"|in)?$/);
  if (feet)
    result = numeric(feet[1]) * 304.8 + (feet[2] ? numeric(feet[2]) * 25.4 : 0);
  else {
    const match = input.match(
      /^(.*?)\s*(mm|cm|m|inches|inch|in|feet|ft|"|')?$/,
    );
    result =
      numeric(match?.[1] || "") * (units[match?.[2] || defaultUnit] || 1);
  }
  if (!Number.isFinite(result))
    throw Error("Use a distance such as 250 mm, 30 cm, 1.2 m or 2' 6\"");
  return result * sign;
}
