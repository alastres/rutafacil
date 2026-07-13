import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FaCar,
  FaMotorcycle,
  FaBicycle,
  FaPersonWalking,
  FaCheck,
  FaTriangleExclamation,
  FaXmark,
  FaArrowRight,
} from "react-icons/fa6";
import type { IconBaseProps } from "react-icons";

export type IconProps = IconBaseProps;

/** Iconos de Font Awesome 6 (vía react-icons) — set profesional y
 * consistente, en vez de emojis del sistema (que se ven distinto en cada
 * dispositivo/OS). Se usan bajo los mismos nombres semánticos de antes para
 * no tocar el resto de los componentes que ya los consumen. */
export const CarIcon = FaCar;
export const MotorbikeIcon = FaMotorcycle;
export const BikeIcon = FaBicycle;
export const WalkIcon = FaPersonWalking;
export const CheckIcon = FaCheck;
export const AlertIcon = FaTriangleExclamation;
export const CloseIcon = FaXmark;
export const ArrowRightIcon = FaArrowRight;

/** Markup estático del check, para el marcador de mapa creado fuera de React
 * (MapLibre construye esos elementos de forma imperativa, sin árbol de
 * React). Se genera desde el mismo icono de la librería para mantener
 * consistencia visual con el resto de la app. */
export const CHECK_SVG_MARKUP = renderToStaticMarkup(
  createElement(FaCheck, { size: 14 }),
);
