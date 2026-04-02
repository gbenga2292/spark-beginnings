import { normalizeDate } from "./src/lib/dateUtils";

const dates = [
  "1/5/2026",
  "01/05/2026",
  "1-5-2026",
  "01-05-2026",
  "2026-05-01",
  "2026/05/01",
  "5/1/2026",
  "1/13/2026",
  "13/1/2026"
];

for (const d of dates) {
  console.log(`${d} -> ${normalizeDate(d)}`);
}
