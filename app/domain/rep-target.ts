export function validRepTarget(value: string) {
  const match = /^([1-9]\d*)(?:\s*-\s*([1-9]\d*))?$/.exec(value.trim());
  return !!match && (!match[2] || Number(match[2]) >= Number(match[1]));
}
