type LogoProps = {
  size?: number;
  className?: string;
};

export function LogoMark({ size = 32, className }: LogoProps) {
  return (
    <img
      src="/logo-mark.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size }}
    />
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
        <span className="text-xl font-bold tracking-tight">Waypoint</span>
      </div>
      {tagline && (
        <p className="mt-1 text-sm text-muted-foreground">
          One Dashboard. Every Goal.
        </p>
      )}
    </div>
  );
}
