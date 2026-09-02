type LogoProps = {
  size?: number;
  className?: string;
};

export function LogoMark({ size = 32, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="waypoint-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
        <linearGradient id="waypoint-needle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2f5f1" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="40" fill="none" stroke="url(#waypoint-ring)" strokeWidth="7" />

      <path d="M50 24 L60 50 L50 76 L40 50 Z" fill="url(#waypoint-needle)" />
      <path d="M50 24 L60 50 L50 50 Z" fill="#dff7f2" opacity="0.55" />

      <circle cx="50" cy="50" r="4.5" fill="url(#waypoint-ring)" />

      <g fill="#5eead4">
        <path d="M78 20 l2.4 5.1 5.1 2.4 -5.1 2.4 -2.4 5.1 -2.4 -5.1 -5.1 -2.4 5.1 -2.4 Z" />
        <circle cx="65" cy="14" r="1.6" />
      </g>
    </svg>
  );
}

type LogoLockupProps = LogoProps & {
  tagline?: boolean;
};

export function Logo({ size = 32, className, tagline = false }: LogoLockupProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <LogoMark size={size} />
        <span className="text-xl font-semibold tracking-tight">Waypoint</span>
      </div>
      {tagline && (
        <p className="mt-1 text-sm text-muted-foreground">
          One Dashboard. Every Goal.
        </p>
      )}
    </div>
  );
}
