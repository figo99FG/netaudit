"use client";

interface Props {
  score: number;
  grade: string;
  size?: number;
}

function scoreColor(score: number) {
  if (score >= 90) return "#00ff88";
  if (score >= 75) return "#44dd88";
  if (score >= 60) return "#ffaa00";
  if (score >= 40) return "#ff7700";
  return "#ff4444";
}

function gradeLabel(grade: string) {
  const labels: Record<string, string> = {
    A: "Excellent", B: "Good", C: "Fair", D: "Poor", F: "Critical",
  };
  return labels[grade] ?? "";
}

export default function ScoreGauge({ score, grade, size = 200 }: Props) {
  const r = (size / 2) * 0.74;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;
  const fillRatio = Math.min(1, Math.max(0, score / 100));
  const dashOffset = circumference * (1 - fillRatio);
  const color = scoreColor(score);
  const trackW = size * 0.082;
  const arcW   = size * 0.072;

  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div className="flex flex-col items-center" style={{ gap: 10 }}>
      <svg
        width={size}
        height={size / 2 + size * 0.18}
        style={{ overflow: "visible" }}
        aria-label={`Security score: ${score} out of 100, Grade ${grade}`}
        role="img"
      >
        {/* Track */}
        <path
          d={arcPath}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth={trackW}
          strokeLinecap="round"
        />

        {/* Glow halo (blurred duplicate) */}
        <path
          d={arcPath}
          fill="none"
          stroke={color}
          strokeWidth={arcW + 4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            opacity: 0.2,
            filter: `blur(${size * 0.03}px)`,
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.6s ease",
          }}
        />

        {/* Main arc */}
        <path
          d={arcPath}
          fill="none"
          stroke={color}
          strokeWidth={arcW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.6s ease",
          }}
        />

        {/* Score number */}
        <text
          x={cx}
          y={cy + size * 0.06}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.26}
          fontWeight="700"
          fontFamily="var(--font-heading, 'Space Grotesk', system-ui)"
          style={{ transition: "fill 0.6s ease" }}
        >
          {score}
        </text>

        {/* /100 label */}
        <text
          x={cx}
          y={cy + size * 0.18}
          textAnchor="middle"
          fill="#4a5a4a"
          fontSize={size * 0.09}
          fontFamily="var(--font-mono, monospace)"
        >
          / 100
        </text>
      </svg>

      {/* Grade badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 14px",
          borderRadius: 6,
          border: `1px solid ${color}28`,
          background: `${color}0c`,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-heading, 'Space Grotesk', system-ui)",
            fontSize: size * 0.115,
            fontWeight: 700,
            color,
          }}
        >
          {grade}
        </span>
        {gradeLabel(grade) && (
          <span style={{ fontSize: 12, color: "#6a7a6a", fontFamily: "var(--font-body)" }}>
            {gradeLabel(grade)}
          </span>
        )}
      </div>
    </div>
  );
}
