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
  FaChevronDown,
  FaPaste,
  FaVolumeHigh,
  FaVolumeXmark,
  FaDownload,
  FaCompass,
} from "react-icons/fa6";
import type { IconBaseProps } from "react-icons";

export type IconProps = IconBaseProps;

/** Iconos de Font Awesome 6 (vía react-icons) — set profesional y
 * consistente. */
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
export const ChevronDownIcon = FaChevronDown;
export const PasteIcon = FaPaste;
export const VolumeIcon = FaVolumeHigh;
export const MuteIcon = FaVolumeXmark;
export const DownloadIcon = FaDownload;
export const CompassIcon = FaCompass;

/** Markup estático del check, para el marcador de mapa creado fuera de React. */
export const CHECK_SVG_MARKUP = renderToStaticMarkup(
  createElement(FaCheck, { size: 14 }),
);

/** Markup estático del pin de punto de retorno. */
export const PIN_SVG_MARKUP = renderToStaticMarkup(
  createElement(FaMapPin, { size: 14 }),
);
