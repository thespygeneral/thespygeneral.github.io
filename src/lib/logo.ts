// The Spy General Elite badge, drawn as a vector so it's crisp at every size.
// Shield + laurel branches + stars + "SPY / GENERAL / ELITE" in olive gold.
// Returns an SVG string so the same artwork is used on the page and for the app icons.

const GOLD_TOP = "#cfc35a";
const GOLD_BOTTOM = "#8e8a2e";
const DARK = "#171a10";

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(" ")}"/>`;
}

/** Leaves along a curved branch (quadratic curve P0 → P2, pulled toward P1). */
function branch(p0: [number, number], p1: [number, number], p2: [number, number], mirror: boolean, id: string): string {
  const leaves: string[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = 0.06 + (i / steps) * 0.9;
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0];
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1];
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const size = 1 - t * 0.35; // leaves get smaller toward the tip
    const rx = (14 * size).toFixed(1);
    const ry = (5.4 * size).toFixed(1);
    for (const side of [-1, 1]) {
      const off = 9 * size;
      const nx = x + side * off * Math.cos(((ang + 90) * Math.PI) / 180);
      const ny = y + side * off * Math.sin(((ang + 90) * Math.PI) / 180);
      // Pointed leaf shape (like the badge), centered on (nx, ny) and turned along the branch.
      const a = Number(rx), h = Number(ry);
      leaves.push(`<path d="M${-a} 0 Q0 ${-h * 1.6} ${a} 0 Q0 ${h * 1.6} ${-a} 0 Z" transform="translate(${nx.toFixed(1)} ${ny.toFixed(1)}) rotate(${(ang + side * 34).toFixed(1)})"/>`);
    }
  }
  const stem = `<path d="M${p0[0]} ${p0[1]} Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}" fill="none" stroke="url(#${id}-gold)" stroke-width="2.4" stroke-linecap="round"/>`;
  const g = `<g fill="url(#${id}-gold)">${stem}${leaves.join("")}</g>`;
  return mirror ? `<g transform="translate(240 0) scale(-1 1)">${g}</g>` : g;
}

export function badgeSvg(opts: { size?: number; title?: string; id?: string; text?: boolean } = {}): string {
  const { size, title = "The Spy General Elite" } = opts;
  // Each badge gets its own ids: if a hidden copy (e.g. the desktop sidebar on a phone) owned the shared
  // gradient, browsers would render every other copy without its gold.
  const id = (opts.id ?? "sg").replace(/[^a-zA-Z0-9_-]/g, "");
  const dims = size ? ` width="${size}" height="${Math.round((size * 270) / 240)}"` : "";
  const shield = "M120 10 C150 24 184 28 212 24 L212 122 C212 182 172 224 120 252 C68 224 28 182 28 122 L28 24 C56 28 90 24 120 10 Z";
  const inner = "M120 22 C147 34 179 38 201 35 L201 122 C201 176 165 212 120 238 C75 212 39 176 39 122 L39 35 C61 38 93 34 120 22 Z";
  const font = `font-family="Oswald, 'Arial Narrow', Impact, sans-serif" font-weight="700" text-anchor="middle" fill="url(#${id}-gold)"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 270"${dims} role="img" aria-label="${title}">
<title>${title}</title>
<defs>
  <linearGradient id="${id}-gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${GOLD_TOP}"/><stop offset="1" stop-color="${GOLD_BOTTOM}"/>
  </linearGradient>
  <!-- Worn, speckled finish like the original badge -->
  <filter id="${id}-worn" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -11 0 0 0 8" result="spots"/>
    <feComposite in="SourceGraphic" in2="spots" operator="in"/>
  </filter>
</defs>
<g filter="url(#${id}-worn)">
${branch([114, 262], [0, 240], [20, 74], false, id)}
${branch([114, 262], [0, 240], [20, 74], true, id)}
</g>
<path d="${shield}" fill="${DARK}"/>
<g filter="url(#${id}-worn)">
<path d="${shield}" fill="none" stroke="url(#${id}-gold)" stroke-width="5" stroke-linejoin="round"/>
<path d="${inner}" fill="none" stroke="url(#${id}-gold)" stroke-width="2" stroke-linejoin="round" opacity="0.85"/>
<g fill="url(#${id}-gold)">${star(120, 50, 9)}${star(98, 216, 7)}${star(120, 219, 8)}${star(142, 216, 7)}</g>
${opts.text === false ? "" : `<text x="120" y="128" ${font} font-size="70" letter-spacing="1">SPY</text>
<text x="120" y="166" ${font} font-size="31" letter-spacing="1.5">GENERAL</text>
<text x="120" y="200" ${font} font-size="31" letter-spacing="2">ELITE</text>`}
</g>
</svg>`;
}
