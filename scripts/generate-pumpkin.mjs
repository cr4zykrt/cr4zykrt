import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.GH_USERNAME;
const token = process.env.GH_TOKEN;
if (!username || !token) throw new Error("GH_USERNAME and GH_TOKEN are required.");

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays {
            date
            contributionCount
            weekday
          }
        }
      }
    }
  }
}`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "halloween-pumpkin-readme"
  },
  body: JSON.stringify({ query, variables: { login: username } })
});

if (!response.ok) throw new Error(`GitHub GraphQL request failed: ${response.status} ${await response.text()}`);
const payload = await response.json();
if (payload.errors?.length) throw new Error(payload.errors.map(e => e.message).join("; "));
const weeks = payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
if (!weeks) throw new Error(`No contribution calendar returned for ${username}.`);

const cell = 13;
const gap = 4;
const step = cell + gap;
const left = 42;
const top = 43;
const cols = weeks.length;
const width = left * 2 + cols * step;
const height = 170;
const days = [];

weeks.forEach((week, x) => {
  week.contributionDays.forEach(day => {
    const y = day.weekday; // GitHub: Sunday=0 through Saturday=6
    days.push({
      date: day.date,
      count: day.contributionCount,
      x: left + x * step,
      y: top + y * step,
      weekday: y
    });
  });
});

// Only days with contributions become eyeballs; animation visits them in date order.
const targets = days.filter(d => d.count > 0).sort((a, b) => a.date.localeCompare(b.date));
const duration = Math.max(12, targets.length * 0.16);
const fmt = n => Number(n.toFixed(2));
const esc = s => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

function eye(d, i) {
  const begin = fmt(i * duration / Math.max(1, targets.length));
  const bite = fmt(Math.max(0.12, duration / Math.max(1, targets.length) * 0.55));
  return `<g transform="translate(${d.x} ${d.y})" opacity="1">
    <title>${esc(d.date)}: ${d.count} contribution(s)</title>
    <ellipse cx="${cell/2}" cy="${cell/2}" rx="6.1" ry="5.2" fill="#f5e9df" stroke="#9d2638" stroke-width="1"/>
    <circle cx="${cell/2}" cy="${cell/2}" r="3.0" fill="#d9233d"/>
    <circle cx="${cell/2}" cy="${cell/2}" r="1.55" fill="#170810"/>
    <circle cx="${cell/2-1}" cy="${cell/2-1.4}" r="0.9" fill="#fff"/>
    <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${Math.max(0,begin/duration)};${Math.min(1,(begin+bite)/duration)};1" dur="${duration}s" repeatCount="indefinite" />
  </g>`;
}

const eyes = targets.map(eye).join("\n");
let pumpkinAnimation = "";
if (targets.length) {
  const first = targets[0];
  const values = targets.map(d => `${fmt(d.x - 17)} ${fmt(d.y - 13)}`);
  values.push(values[0]);
  const keyTimes = targets.map((_, i) => fmt(i / targets.length));
  keyTimes.push("1");
  pumpkinAnimation = `<animateTransform attributeName="transform" type="translate" values="${values.join(";")}" keyTimes="${keyTimes.join(";")}" calcMode="discrete" dur="${duration}s" repeatCount="indefinite"/>`;
}

const pumpkin = `<g>
  ${pumpkinAnimation}
  <g>
    <path d="M 16 9 Q 9 -2 21 -5 Q 29 -4 25 7" fill="#527b2b" stroke="#8baa43" stroke-width="2"/>
    <ellipse cx="19" cy="18" rx="17" ry="18" fill="#f58220" stroke="#9b350d" stroke-width="2"/>
    <path d="M 9 3 Q 3 18 10 32 M 19 1 Q 14 18 19 35 M 29 4 Q 35 18 28 31" fill="none" stroke="#c84b10" stroke-width="2"/>
    <path d="M 7 13 L 15 17 L 10 22 Z M 23 17 L 31 13 L 27 23 Z" fill="#fff19b" stroke="#fff19b" stroke-width="1"/>
    <path d="M 9 25 Q 19 33 29 24 L 26 30 L 13 30 Z" fill="#fff19b" stroke="#fff19b" stroke-width="1"/>
    <animate attributeName="opacity" values="1;1;0.78;1" dur="0.8s" repeatCount="indefinite"/>
  </g>
</g>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0916"/>
      <stop offset="100%" stop-color="#080508"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" rx="12" fill="url(#bg)"/>
  <text x="${width/2}" y="19" text-anchor="middle" fill="#ff7518" font-family="monospace" font-size="12" letter-spacing="3">CONTRIBUTION GRAVEYARD</text>
  <text x="${width/2}" y="${height-12}" text-anchor="middle" fill="#d7c1d0" font-family="monospace" font-size="10">EYES DETECTED: ${targets.length}  •  PUMPKIN HUNGER: UNENDING</text>
  <g fill="#30212b" stroke="#4d2636" stroke-width="0.7">
    ${days.map(d => `<rect x="${d.x}" y="${d.y}" width="${cell}" height="${cell}" rx="2"/>`).join("\n")}
  </g>
  <g filter="url(#glow)">
    ${eyes}
  </g>
  ${targets.length ? pumpkin : `<text x="${width/2}" y="${height/2}" text-anchor="middle" fill="#ff7518" font-family="monospace">No contributions found yet</text>`}
</svg>`;

await mkdir("dist", { recursive: true });
await writeFile("dist/halloween-pumpkin.svg", svg, "utf8");
console.log(`Generated animation for ${username}: ${targets.length} contribution dates, ${cols} calendar weeks.`);
