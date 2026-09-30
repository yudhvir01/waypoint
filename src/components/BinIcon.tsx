export function BinIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9.2c0 .7.6 1.3 1.3 1.3h4.2c.7 0 1.3-.6 1.3-1.3L12 4M6.5 7v4.5M9.5 7v4.5" />
    </svg>
  );
}
