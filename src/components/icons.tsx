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
  FaMapPin,
  FaPlus,
  FaGripVertical,
  FaMap,
  FaList,
  FaLocationArrow,
  FaRoute,
  FaTrash,
  FaLock,
  FaCrown,
  FaWhatsapp,
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
export const PinIcon = FaMapPin;
export const PlusIcon = FaPlus;
export const DragHandleIcon = FaGripVertical;
export const MapIcon = FaMap;
export const ListIcon = FaList;
export const TrackIcon = FaLocationArrow;
export const RouteIcon = FaRoute;
export const TrashIcon = FaTrash;
export const LockIcon = FaLock;
export const CrownIcon = FaCrown;
export const WhatsappIcon = FaWhatsapp;

/** Markup estático del check, para el marcador de mapa creado fuera de React
 * (MapLibre construye esos elementos de forma imperativa, sin árbol de
 * React). Se genera desde el mismo icono de la librería para mantener
 * consistencia visual con el resto de la app. */
export const CHECK_SVG_MARKUP = renderToStaticMarkup(
  createElement(FaCheck, { size: 14 }),
);

/** Markup estático del pin de punto de retorno, para el marcador de mapa
 * creado fuera de React (MapLibre construye esos elementos de forma
 * imperativa, sin árbol de React). */
export const PIN_SVG_MARKUP = renderToStaticMarkup(
  createElement(FaMapPin, { size: 14 }),
);
