import { parseFitlog } from "../app/interchange/fitlog";

const wrap = (intervals: string) =>
  `[FITLOG:1]\nWORKOUT|Move|2026-01-15\nMOBILITY|Stretch\nINTERVALS|${intervals}\n[/FITLOG]`;

const sized = (unit: string, bytes: number, extra = "") => {
  const raw = unit.repeat(Math.ceil(bytes / unit.length));
  if (!extra) return raw.slice(0, bytes);
  return raw.slice(0, Math.max(0, bytes - extra.length)) + extra;
};

const median = (label: string, text: string, samples = 5) => {
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    parseFitlog(text, "lb", {});
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const mid = times[Math.floor(times.length / 2)];
  console.log(`${label.padEnd(28)} ${String(text.length).padStart(6)} B  median ${mid.toFixed(2)} ms`);
  return mid;
};

const extra = " leftover";
const rows: Array<[string, number]> = [];
for (const bytes of [16 * 1024, 32 * 1024]) {
  rows.push([`space-dash ${bytes}`, median(`space-dash ${bytes}`, wrap(sized(" -", bytes)))]);
  rows.push([`space-dash+tail ${bytes}`, median(`space-dash+tail ${bytes}`, wrap(sized(" -", bytes, extra)))]);
  rows.push([`space-colon ${bytes}`, median(`space-colon ${bytes}`, wrap(sized(" :", bytes)))]);
  rows.push([`space-colon+tail ${bytes}`, median(`space-colon+tail ${bytes}`, wrap(sized(" :", bytes, extra)))]);
  rows.push([`dashes ${bytes}`, median(`dashes ${bytes}`, wrap(sized("-", bytes)))]);
}
median("ordinary", wrap("Hip flexor stretch — 30 sec/side; World's greatest stretch 5 x 30 sec"), 7);
const by = Object.fromEntries(rows);
const ratio = (kind: string) => by[`${kind} 32768`] / by[`${kind} 16384`];
console.log(`growth space-dash+tail ${ratio("space-dash+tail").toFixed(2)}x`);
console.log(`growth space-colon+tail ${ratio("space-colon+tail").toFixed(2)}x`);
console.log(`growth dashes ${ratio("dashes").toFixed(2)}x`);
