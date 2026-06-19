/** Lucide Target-style icon in Dugout Intel primary blue */
export default function Icon() {
  const blue = "#3b82f6";

  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="white" />
      <circle cx="16" cy="16" r="11" stroke={blue} strokeWidth="2" />
      <circle cx="16" cy="16" r="6.5" stroke={blue} strokeWidth="2" />
      <circle cx="16" cy="16" r="2.5" fill={blue} />
    </svg>
  );
}
