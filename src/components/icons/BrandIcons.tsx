// Brand SVG icons for integration providers.
// Sized via className/style on the wrapping <svg>.

import type { SVGProps } from "react";

export function FigmaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 38 57" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1ABCFE" />
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0ACF83" />
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262" />
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E" />
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF" />
    </svg>
  );
}

export function JiraIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <defs>
        <linearGradient id="jira-a" x1="22.03" y1="13.4" x2="16.36" y2="19.18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0052CC" />
          <stop offset="1" stopColor="#2684FF" />
        </linearGradient>
        <linearGradient id="jira-b" x1="9.97" y1="18.6" x2="15.62" y2="12.84" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0052CC" />
          <stop offset="1" stopColor="#2684FF" />
        </linearGradient>
      </defs>
      <path
        d="M30.05 15.27L17.27 2.5 16 1.23l-9.62 9.62-4.41 4.42a1.04 1.04 0 0 0 0 1.46L11.21 25.8 16 30.59l9.62-9.62.15-.15 4.28-4.27a1.04 1.04 0 0 0 0-1.28zM16 21.32L11.18 16.5 16 11.68l4.82 4.82L16 21.32z"
        fill="#2684FF"
      />
      <path d="M16 11.68a8.1 8.1 0 0 1-.04-11.4L6.39 9.78l5.45 5.45L16 11.68z" fill="url(#jira-a)" />
      <path d="M20.83 16.49L16 21.32a8.1 8.1 0 0 1 0 11.46l9.65-9.65-4.82-4.64z" fill="url(#jira-b)" />
    </svg>
  );
}
