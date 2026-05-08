"use client";

interface Props {
  score: number;
  grade: string;
  size?: number;
}

function scoreColor(score: number) {
  if (score >= 90) return "#00ff88";
  if (score >= 75) return "#44cc88";
  if (score >= 60) return "#ffaa00";
  if (score >= 40) return "#ff7700";
  return "#ff4444";
}

export default function ScoreGauge({ score, grade, size = 200 }: Props) {
  const r = (size / 2) * 0.75;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r; // half circle
  const startAngle = 180; // degrees
  const fillRatio = score / 100;
  const dashOffset = circumference * (1 - fillRatio);
  const color = scoreColor(score);

  // Arc from 180° to 0° (left to right, bottom half hidden)
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size / 2 + 20} style={{ overflow: "visible" }}>
        {/* Track */}
        <path
          d={arcPath}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={size * 0.08}
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={arcPath}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.08}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s ease" }}
        />
        {/* Score text */}
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.22}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {score}
        </text>
        {/* /100 */}
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          fill="#718096"
          fontSize={size * 0.09}
          fontFamily="monospace"
        >
          / 100
        </text>
      </svg>
      <span
        className="text-2xl font-bold px-3 py-1 rounded"
        style={{ color, border: `1px solid ${color}22`, background: `${color}11` }}
      >
        Grade {grade}
      </span>
    </div>
  );
}
