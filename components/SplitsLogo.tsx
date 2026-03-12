interface SplitsLogoProps {
  size?: "sm" | "md" | "lg" | "xl"
  showWordmark?: boolean
  variant?: "light" | "dark"
}

const sizeConfig = {
  sm: { icon: 20, textClass: "text-base", gap: "gap-2" },
  md: { icon: 28, textClass: "text-xl", gap: "gap-2.5" },
  lg: { icon: 36, textClass: "text-2xl", gap: "gap-3" },
  xl: { icon: 48, textClass: "text-3xl", gap: "gap-3.5" },
}

function SplitSIcon({ size, color = "#10B981" }: { size: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Top half of the S — upper curve and crossbar flowing right */}
      <path
        d="M14 8C14 8 17.5 4 24.5 4C31.5 4 36 8 36 13C36 18 31 20.5 25.5 21.5L16 23"
        stroke={color}
        strokeWidth="5.5"
        strokeLinecap="square"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Bottom half of the S — lower curve and crossbar flowing left */}
      <path
        d="M34 40C34 40 30.5 44 23.5 44C16.5 44 12 40 12 35C12 30 17 27.5 22.5 26.5L32 25"
        stroke={color}
        strokeWidth="5.5"
        strokeLinecap="square"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default function SplitsLogo({ size = "md", showWordmark = true, variant = "dark" }: SplitsLogoProps) {
  const config = sizeConfig[size]
  const textColor = variant === "light" ? "text-white" : "text-slate-900"

  return (
    <div className={`flex items-center ${config.gap}`}>
      <SplitSIcon size={config.icon} />
      {showWordmark && (
        <span className={`${config.textClass} font-semibold tracking-tight ${textColor}`} style={{ fontFamily: "'Inter', sans-serif" }}>
          Splits
        </span>
      )}
    </div>
  )
}

export { SplitSIcon }
