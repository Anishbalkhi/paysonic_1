"use client";

export default function Sparkline({ points = [], color: customColor }) {
  const w = 78;
  const h = 34;
  const pad = 4;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const step = w / (points.length - 1 || 1);
  const down = points[points.length - 1] < points[0];
  const color = customColor || (down ? "#EF4444" : "var(--role-primary, #15803D)");
  const id = "sp" + points.join("-").replace(/\W/g, "");

  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
