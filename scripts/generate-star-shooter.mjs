// Generates an animated "shooting gallery" SVG from a GitHub user's contribution calendar.
// A pistol on the left fires one bullet per contribution day; each bullet turns its target into a star.
//
// Env: GITHUB_TOKEN (required unless MOCK=1), USERNAME (default cr4zykrt), OUT (default dist/star-shooter.svg)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const USER = process.env.USERNAME || 'cr4zykrt';
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = process.env.OUT || 'dist/star-shooter.svg';

const C = {
  cream: '#F2E6C9', red: '#C8442F', mus: '#E0A526', teal: '#2F7F86',
  navy: '#1F3140', dim: '#D8C79B', ring: '#CDB77F', band: '#EBDCB3',
};
const LEVELS = ['#EBC25A', '#E0A526', '#D9742B', '#C8442F'];
const HF = "Impact, 'Arial Black', 'Haettenschweiler', sans-serif";
const SF = "Georgia, 'Times New Roman', serif";
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// ------------------------------------------------------------------ data
async function load() {
  if (process.env.MOCK) {
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const weeks = [];
    let total = 0;
    const start = new Date(Date.UTC(2025, 9, 26));
    for (let w = 0; w < 53; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        if (w === 52 && d > 0) break;
        const count = rnd() > 0.82 ? Math.ceil(rnd() * 9) : 0;
        total += count;
        const dt = new Date(start.getTime() + (w * 7 + d) * 86400000);
        days.push({ count, weekday: d, date: dt.toISOString().slice(0, 10) });
      }
      weeks.push(days);
    }
    return { total, weeks };
  }
  if (!TOKEN) throw new Error('GITHUB_TOKEN is not set');
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount weekday date}}}}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'star-shooter' },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) throw new Error('GitHub API error: ' + JSON.stringify(json.errors || json));
  return {
    total: cal.totalContributions,
    weeks: cal.weeks.map((w) =>
      w.contributionDays.map((d) => ({ count: d.contributionCount, weekday: d.weekday, date: d.date }))
    ),
  };
}

// ------------------------------------------------------------------ helpers
const f1 = (n) => Number(n.toFixed(1));

function starPoints(R, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(rad * Math.cos(a)).toFixed(2)},${(rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

// points: [[seconds, value], ...] sorted, first at 0, last at T
function track(points, T) {
  const kt = [];
  const vals = [];
  let prev = -1;
  points.forEach(([t, v], i) => {
    let k = Math.min(Math.max(t / T, 0), 1);
    if (i === points.length - 1) k = 1;
    if (kt.length && k <= prev) k = Math.min(prev + 1e-5, 1);
    prev = k;
    kt.push(k.toFixed(5));
    vals.push(v);
  });
  return { kt: kt.join(';'), vals: vals.join(';') };
}

const anim = (attr, pts, T, extra = '') => {
  const { kt, vals } = track(pts, T);
  return `<animate attributeName="${attr}" values="${vals}" keyTimes="${kt}" dur="${T.toFixed(2)}s" repeatCount="indefinite"${extra}/>`;
};
const animT = (type, pts, T) => {
  const { kt, vals } = track(pts, T);
  return `<animateTransform attributeName="transform" type="${type}" values="${vals}" keyTimes="${kt}" dur="${T.toFixed(2)}s" repeatCount="indefinite"/>`;
};

// ------------------------------------------------------------------ build
function build(data) {
  const W = 900, H = 250;
  const weeks = data.weeks;
  const cols = weeks.length;
  const pitch = Math.min(14, Math.floor((730 / cols) * 10) / 10);
  const gx = 130, gy = 96;
  const X = (c) => gx + c * pitch + pitch / 2;
  const Y = (r) => gy + r * pitch + pitch / 2;

  const counts = weeks.flat().map((d) => d.count);
  const max = Math.max(1, ...counts);
  const lvl = (n) => Math.min(4, Math.max(1, Math.ceil((n / max) * 4)));

  // shots, left to right
  const shots = [];
  weeks.forEach((days, c) => days.forEach((d) => { if (d.count > 0) shots.push({ c, r: d.weekday, n: d.count }); }));
  shots.sort((a, b) => a.c - b.c || a.r - b.r);
  const N = shots.length;

  const MUZZLE_X = 114;
  const PX = 24;
  const interval = N ? Math.min(0.28, Math.max(0.1, 12 / N)) : 0;
  const t0 = 0.8;
  shots.forEach((s, i) => {
    s.ts = t0 + i * interval;
    s.x = X(s.c);
    s.y = Y(s.r);
    s.travel = (s.x - MUZZLE_X) / 900;
    s.th = s.ts + s.travel;
  });
  const lastHit = N ? Math.max(...shots.map((s) => s.th)) : 0;
  const fade = 0.8, hold = 3;
  const T = N ? lastHit + hold + fade : 4;
  const midY = Y(3) + 2;

  let out = '';

  // frame + ribbon
  out += `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="${C.cream}" stroke="${C.navy}" stroke-width="6"/>`;
  out += `<rect x="14" y="14" width="${W - 28}" height="40" fill="${C.red}"/>`;
  out += `<text x="450" y="41" text-anchor="middle" font-family="${HF}" font-size="19" letter-spacing="3" fill="${C.cream}">★  SHOOTING GALLERY  ★  ${data.total} CONTRIBUTIONS IN THE LAST YEAR  ★</text>`;

  // target band
  out += `<rect x="${gx - 10}" y="${gy - 28}" width="${cols * pitch + 20}" height="${7 * pitch + 38}" fill="${C.band}" stroke="${C.navy}" stroke-width="2"/>`;

  // month labels
  let lastMonth = -1, lastCol = -10;
  weeks.forEach((days, c) => {
    const m = Number(days[0].date.slice(5, 7)) - 1;
    if (m !== lastMonth) {
      if (c - lastCol >= 3) {
        out += `<text x="${f1(gx + c * pitch)}" y="${gy - 11}" font-family="${SF}" font-size="11" letter-spacing="1" fill="${C.navy}">${MONTHS[m]}</text>`;
        lastCol = c;
      }
      lastMonth = m;
    }
  });

  // targets
  weeks.forEach((days, c) => days.forEach((d) => {
    if (d.count > 0) out += `<circle cx="${f1(X(c))}" cy="${f1(Y(d.weekday))}" r="4.2" fill="none" stroke="${C.ring}" stroke-width="1.2"/>`;
    else out += `<circle cx="${f1(X(c))}" cy="${f1(Y(d.weekday))}" r="1.8" fill="${C.dim}"/>`;
  }));

  // bullets
  const bulletR = 3;
  shots.forEach((s) => {
    const x0 = MUZZLE_X, x1 = f1(s.x);
    out += `<circle cx="${x0}" cy="${f1(s.y)}" r="${bulletR}" fill="${C.mus}" stroke="${C.navy}" stroke-width="0.8" opacity="0">`
      + anim('cx', [[0, x0], [s.ts, x0], [s.th, x1], [T, x1]], T)
      + anim('opacity', [[0, 0], [s.ts, 1], [s.th, 0], [T, 0]], T, ' calcMode="discrete"')
      + '</circle>';
  });

  // stars that pop in on impact
  const sp = starPoints(6.4, 2.7);
  shots.forEach((s) => {
    const color = LEVELS[lvl(s.n) - 1];
    out += `<g transform="translate(${f1(s.x)} ${f1(s.y)})"><g transform="scale(0)">`
      + animT('scale', [[0, 0], [s.th, 0], [s.th + 0.12, 1.6], [s.th + 0.26, 1], [T - fade, 1], [T, 0]], T)
      + `<polygon points="${sp}" fill="${color}" stroke="${C.navy}" stroke-width="0.8" stroke-linejoin="round"/></g></g>`;
  });

  // pistol (rides up and down to line up with each row)
  const yPts = [[0, midY]];
  shots.forEach((s) => { yPts.push([s.ts - 0.08, s.y + 2]); yPts.push([s.ts, s.y + 2]); });
  if (N) {
    const last = shots[N - 1];
    yPts.push([last.ts + 0.5, last.y + 2]);
    yPts.push([Math.max(last.ts + 0.9, T - fade), midY]);
  }
  yPts.push([T, midY]);
  const yTrack = track(yPts, T);

  const recoil = [[0, '0 12 26']];
  const flash = [[0, 0]];
  shots.forEach((s) => {
    recoil.push([s.ts, '0 12 26'], [s.ts + 0.03, '-9 12 26'], [s.ts + 0.09, '0 12 26']);
    flash.push([s.ts, 1], [s.ts + 0.05, 0]);
  });
  recoil.push([T, '0 12 26']);
  flash.push([T, 0]);

  out += `<g transform="translate(${PX} ${f1(midY)})">`
    + `<animateTransform attributeName="transform" type="translate" values="${yTrack.vals.split(';').map((v) => `${PX} ${f1(Number(v))}`).join(';')}" keyTimes="${yTrack.kt}" dur="${T.toFixed(2)}s" repeatCount="indefinite"/>`
    + `<g>` + animT('rotate', recoil, T)
    + `<rect x="-6" y="-13" width="92" height="22" rx="5" fill="${C.navy}"/>`
    + `<rect x="0" y="-9" width="74" height="4" fill="${C.mus}"/>`
    + `<rect x="78" y="-13" width="8" height="22" rx="3" fill="${C.red}"/>`
    + `<path d="M68 -13 L72 -20 L76 -13 Z" fill="${C.navy}"/>`
    + `<path d="M-4 9 L26 9 L19 46 Q4 51 -12 46 Z" fill="${C.red}" stroke="${C.navy}" stroke-width="3" stroke-linejoin="round"/>`
    + `<polygon points="${starPoints(7, 3)}" transform="translate(6 29)" fill="${C.cream}"/>`
    + `<path d="M28 9 Q38 32 54 9" fill="none" stroke="${C.navy}" stroke-width="4" stroke-linecap="round"/>`
    + `<path d="M40 9 L38 21" stroke="${C.mus}" stroke-width="4" stroke-linecap="round"/>`
    + `<polygon points="${starPoints(12, 5)}" transform="translate(98 -2)" fill="${C.mus}" stroke="${C.red}" stroke-width="1.5" opacity="0">`
    + anim('opacity', flash, T, ' calcMode="discrete"') + '</polygon>'
    + `</g></g>`;

  // legend
  let lx = 640;
  out += `<text x="${lx}" y="${H - 20}" font-family="${SF}" font-size="11" letter-spacing="2" fill="${C.navy}">LESS</text>`;
  lx += 44;
  LEVELS.forEach((col, i) => {
    out += `<polygon points="${starPoints(6.4, 2.7)}" transform="translate(${lx + i * 18} ${H - 24})" fill="${col}" stroke="${C.navy}" stroke-width="0.8" stroke-linejoin="round"/>`;
  });
  out += `<text x="${lx + 4 * 18 + 4}" y="${H - 20}" font-family="${SF}" font-size="11" letter-spacing="2" fill="${C.navy}">MORE</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Shooting gallery: a pistol fires ${data.total} contributions as stars">${out}</svg>\n`;
}

const data = await load();
const svg = build(data);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`wrote ${OUT} (${svg.length} bytes, ${data.total} contributions)`);
