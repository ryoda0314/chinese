type IconName = "speaker" | "mic" | "back" | "arrow" | "shower" | "user" | "check" | "replay";

const PATHS: Record<IconName, React.ReactNode> = {
  speaker: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  replay: (
    <>
      <path d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
  // A cloud with rain falling from it, as in ことのあめ: the rain.
  shower: (
    <>
      <path d="M7 13.5h10a3.5 3.5 0 0 0 .2-7A5 5 0 0 0 7.7 7.6 3 3 0 0 0 7 13.5z" />
      <path d="M9 17v2.5" />
      <path d="M12 16.5v4" />
      <path d="M15 17v2.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
