import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 20,
  height: 20,
  "aria-hidden": true,
};

/** Iconos propios de línea, estilo señalética — sustituyen los emojis del
 * sistema (que se ven distinto en cada dispositivo) por trazos consistentes
 * que heredan el color del texto (currentColor). */

export function CarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 11.5 6 7.3a2 2 0 0 1 1.9-1.3h8.2a2 2 0 0 1 1.9 1.3l1.5 4.2" />
      <rect x="3" y="11.5" width="18" height="5" rx="1.2" />
      <circle cx="7.5" cy="17.2" r="1.6" />
      <circle cx="16.5" cy="17.2" r="1.6" />
    </svg>
  );
}

export function MotorbikeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="5.5" cy="17.5" r="3" />
      <circle cx="18.5" cy="17.5" r="3" />
      <path d="M5.5 17.5h4l3-5h4l2.5 5" />
      <path d="M12.5 12.5 14.3 9.5h2.2" />
      <path d="M9 12.5h3" />
    </svg>
  );
}

export function BikeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="5.5" cy="17.5" r="3.3" />
      <circle cx="18.5" cy="17.5" r="3.3" />
      <path d="M5.5 17.5 9.5 9h3.5L10.5 17.5" />
      <path d="M9.5 9h3" />
      <path d="M13 9l5.5 8.5" />
      <path d="M9.5 17.5h9" />
    </svg>
  );
}

export function WalkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="13" cy="4.3" r="1.7" />
      <path d="M12.3 6.8 10 9l-3 1.5" />
      <path d="M12.3 6.8 14.8 8.5l2.7 1" />
      <path d="M11.3 9.8 9.3 17" />
      <path d="M13 10l2.8 2 -0.8 6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12.5 9 17.5 20 6" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.3 21.3 20H2.7Z" strokeLinejoin="round" />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="16.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5l14 14" />
      <path d="M19 5 5 19" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

/** Versión en cadena (no-JSX) del check, para marcadores de mapa creados de
 * forma imperativa (MapLibre no usa el árbol de React para sus elementos). */
export const CHECK_SVG_MARKUP =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6"/></svg>';
