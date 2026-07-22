import { defaultRouteLabel, formatElapsed, type RouteHistoryRecord } from "./historyDb";

export function formatCurrency(val?: number | null): string {
  if (typeof val !== "number" || isNaN(val)) return "$0";
  return `$${Math.round(val).toLocaleString("es-CO")}`;
}

export function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateFull(ts: number): string {
  return new Date(ts).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Genera el texto del reporte individual de rendición para una ruta completada o en curso (sin emojis).
 */
export function generateSingleRouteReport(record: RouteHistoryRecord): string {
  const stops = record.stops ?? [];
  const deliveredStops = stops.filter((s) => s.delivered);
  
  let totalCollect = 0;
  let totalAllowance = 0;

  stops.forEach((s) => {
    if (s.delivered && typeof s.collectAmount === "number") totalCollect += s.collectAmount;
    if (s.delivered && typeof s.travelAllowance === "number") totalAllowance += s.travelAllowance;
  });

  const netBalance = totalCollect - totalAllowance;
  const label = record.label || defaultRouteLabel(record.createdAt);
  const distanceStr = typeof record.distanceKm === "number" && !isNaN(record.distanceKm) ? `${record.distanceKm.toFixed(1)} km` : "N/A";
  const durationStr = typeof record.elapsedMs === "number" && !isNaN(record.elapsedMs) ? formatElapsed(record.elapsedMs) : "N/A";

  let msg = `=== REPORTES DE RENDICION DE DESPACHO ===\n`;
  msg += `Ruta: ${label}\n`;
  msg += `Vehiculo: ${record.mode.toUpperCase()} | Distancia: ${distanceStr} | Duracion: ${durationStr}\n\n`;

  msg += `----------------------------------------\n`;
  msg += `(+) Total Cobrado: ${formatCurrency(totalCollect)}\n`;
  msg += `(-) Total Viaticos: ${formatCurrency(totalAllowance)}\n`;
  msg += `(=) BALANCE NETO A ENTREGAR: ${formatCurrency(netBalance)}\n`;
  msg += `----------------------------------------\n\n`;

  msg += `DETALLE DE PARADAS (${deliveredStops.length}/${record.stopsTotal}):\n`;

  if (stops.length === 0) {
    msg += `(Sin desglose de paradas registrado)\n`;
  } else {
    stops.forEach((s, idx) => {
      const statusTag = s.delivered ? "[OK]" : "[PENDIENTE]";
      const timeStr = s.deliveredAt ? `[${formatDateShort(s.deliveredAt)}] ` : "";
      msg += `${statusTag} ${idx + 1}. ${timeStr}${s.label}`;
      
      const extras: string[] = [];
      if (typeof s.collectAmount === "number" && s.collectAmount > 0) extras.push(`Cobro: ${formatCurrency(s.collectAmount)}`);
      if (typeof s.travelAllowance === "number" && s.travelAllowance > 0) extras.push(`Viaticos: ${formatCurrency(s.travelAllowance)}`);
      if (s.notes) extras.push(`Nota: ${s.notes}`);

      if (extras.length > 0) {
        msg += ` (${extras.join(" | ")})`;
      }
      msg += `\n`;
    });
  }

  msg += `\nRutaFacil App`;
  return msg;
}

/**
 * Genera el reporte consolidado por lotes (Batch Share) para múltiples rutas seleccionadas con desglose completo.
 */
export function generateBatchRouteReport(records: RouteHistoryRecord[]): string {
  if (records.length === 0) return "No hay rutas seleccionadas.";
  if (records.length === 1) return generateSingleRouteReport(records[0]);

  let totalStopsCount = 0;
  let totalDeliveredCount = 0;
  let totalDistanceKm = 0;
  let grandTotalCollect = 0;
  let grandTotalAllowance = 0;

  records.forEach((r) => {
    totalStopsCount += r.stopsTotal ?? 0;
    totalDeliveredCount += r.stopsDelivered ?? 0;
    if (typeof r.distanceKm === "number" && !isNaN(r.distanceKm)) {
      totalDistanceKm += r.distanceKm;
    }

    const stops = r.stops ?? [];
    stops.forEach((s) => {
      if (s.delivered && typeof s.collectAmount === "number") grandTotalCollect += s.collectAmount;
      if (s.delivered && typeof s.travelAllowance === "number") grandTotalAllowance += s.travelAllowance;
    });
  });

  const grandNetBalance = grandTotalCollect - grandTotalAllowance;
  const reportDate = formatDateFull(Date.now());

  let msg = `=== CONSOLIDADO GLOBAL DE DESPACHOS (${records.length} RUTAS) ===\n`;
  msg += `Fecha de Reporte: ${reportDate}\n`;
  msg += `Recorrido Total: ${totalDistanceKm.toFixed(1)} km | Entregas Totales: ${totalDeliveredCount}/${totalStopsCount}\n\n`;

  msg += `========================================\n`;
  msg += `(+) TOTAL COBRADO ACUMULADO: ${formatCurrency(grandTotalCollect)}\n`;
  msg += `(-) TOTAL VIATICOS ACUMULADOS: ${formatCurrency(grandTotalAllowance)}\n`;
  msg += `(=) BALANCE GENERAL A ENTREGAR: ${formatCurrency(grandNetBalance)}\n`;
  msg += `========================================\n\n`;

  msg += `DESGLOSE DETALLADO POR RUTA:\n\n`;

  records.forEach((r, idx) => {
    let rCollect = 0;
    let rAllowance = 0;
    const stops = r.stops ?? [];
    stops.forEach((s) => {
      if (s.delivered && typeof s.collectAmount === "number") rCollect += s.collectAmount;
      if (s.delivered && typeof s.travelAllowance === "number") rAllowance += s.travelAllowance;
    });
    const rBalance = rCollect - rAllowance;
    const label = r.label || defaultRouteLabel(r.createdAt);
    const distStr = typeof r.distanceKm === "number" && !isNaN(r.distanceKm) ? `${r.distanceKm.toFixed(1)} km` : "N/A";
    const durStr = typeof r.elapsedMs === "number" && !isNaN(r.elapsedMs) ? formatElapsed(r.elapsedMs) : "N/A";

    msg += `--- RUTA ${idx + 1}: ${label} ---\n`;
    msg += `Vehiculo: ${r.mode.toUpperCase()} | Distancia: ${distStr} | Duracion: ${durStr}\n`;
    msg += `Cobro: ${formatCurrency(rCollect)} | Viaticos: ${formatCurrency(rAllowance)} | Balance Neto: ${formatCurrency(rBalance)}\n`;
    msg += `Paradas (${r.stopsDelivered}/${r.stopsTotal}):\n`;

    if (stops.length === 0) {
      msg += `  (Sin desglose de paradas)\n`;
    } else {
      stops.forEach((s, sIdx) => {
        const statusTag = s.delivered ? "[OK]" : "[PENDIENTE]";
        const timeStr = s.deliveredAt ? `[${formatDateShort(s.deliveredAt)}] ` : "";
        msg += `  ${statusTag} ${sIdx + 1}. ${timeStr}${s.label}`;
        
        const extras: string[] = [];
        if (typeof s.collectAmount === "number" && s.collectAmount > 0) extras.push(`Cobro: ${formatCurrency(s.collectAmount)}`);
        if (typeof s.travelAllowance === "number" && s.travelAllowance > 0) extras.push(`Viaticos: ${formatCurrency(s.travelAllowance)}`);
        if (s.notes) extras.push(`Nota: ${s.notes}`);

        if (extras.length > 0) {
          msg += ` (${extras.join(" | ")})`;
        }
        msg += `\n`;
      });
    }
    msg += `\n`;
  });

  msg += `RutaFacil App`;
  return msg;
}

/**
 * Genera el mensaje de WhatsApp que envía el despachador al grupo con el Smart Link (sin emojis).
 */
export function generateWhatsAppDispatchText(data: {
  geoUrl: string;
  label: string;
  collectAmount?: number;
  travelAllowance?: number;
  notes?: string;
  assignee?: string;
}): string {
  const { geoUrl, label, collectAmount, travelAllowance, notes, assignee } = data;

  let msg = `[NUEVO PEDIDO ASIGNADO]\n`;
  if (assignee) msg += `Repartidor: @${assignee}\n`;
  msg += `Direccion: ${label}\n`;
  if (typeof collectAmount === "number" && collectAmount > 0) {
    msg += `Cobrar al cliente: ${formatCurrency(collectAmount)}\n`;
  }
  if (typeof travelAllowance === "number" && travelAllowance > 0) {
    msg += `Viaticos asignados: ${formatCurrency(travelAllowance)}\n`;
  }
  if (notes) {
    msg += `Notas: ${notes}\n`;
  }

  msg += `\nToca para cargar en RutaFacil:\n${geoUrl}`;
  return msg;
}

/**
 * Abre la interfaz nativa Web Share API o redirige a WhatsApp con el mensaje cargado.
 */
export async function shareText(title: string, text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      // Si el usuario canceló el diálogo nativo o falló, cae al enlace directo
    }
  }

  const encoded = encodeURIComponent(text);
  const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
  if (typeof window !== "undefined") {
    window.open(waUrl, "_blank", "noopener,noreferrer");
    return true;
  }
  return false;
}
