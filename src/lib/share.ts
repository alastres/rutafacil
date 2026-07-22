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
 * Genera el texto formateado para WhatsApp del reporte individual de rendición.
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

  let msg = `📊 *RENDICIÓN DE DESPACHO Y RECORRIDO*\n`;
  msg += `📋 *Ruta:* ${label}\n`;
  msg += `🚘 *Vehículo:* ${record.mode.toUpperCase()} | 📏 *Distancia:* ${distanceStr} | ⏱️ *Duración:* ${durationStr}\n\n`;

  msg += `----------------------------------------\n`;
  msg += `💵 *Total Cobrado:* ${formatCurrency(totalCollect)}\n`;
  msg += `⛽ *Total Viáticos Otorgados:* ${formatCurrency(totalAllowance)}\n`;
  msg += `💰 *BALANCE NETO A ENTREGAR:* ${formatCurrency(netBalance)}\n`;
  msg += `----------------------------------------\n\n`;

  msg += `✅ *DETALLE DE ENTREGAS (${deliveredStops.length}/${record.stopsTotal}):*\n`;

  if (stops.length === 0) {
    msg += `(Sin desglose de paradas registrado)\n`;
  } else {
    stops.forEach((s, idx) => {
      const statusIcon = s.delivered ? "✅" : "⏳";
      const timeStr = s.deliveredAt ? `[${formatDateShort(s.deliveredAt)}] ` : "";
      msg += `${statusIcon} ${idx + 1}. ${timeStr}${s.label}`;
      
      const extras: string[] = [];
      if (typeof s.collectAmount === "number" && s.collectAmount > 0) extras.push(`💵 ${formatCurrency(s.collectAmount)}`);
      if (typeof s.travelAllowance === "number" && s.travelAllowance > 0) extras.push(`⛽ ${formatCurrency(s.travelAllowance)}`);
      if (s.notes) extras.push(`📝 ${s.notes}`);

      if (extras.length > 0) {
        msg += ` (${extras.join(" | ")})`;
      }
      msg += `\n`;
    });
  }

  msg += `\n🚀 *Generado desde RutaFácil*`;
  return msg;
}

/**
 * Genera el reporte consolidado por lotes (Batch Share) para WhatsApp con desglose enriquecido y emojis.
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

  let msg = `📑 *CONSOLIDADO GLOBAL DE DESPACHOS (${records.length} RUTAS)*\n`;
  msg += `📅 *Fecha:* ${reportDate}\n`;
  msg += `🛣️ *Recorrido Total:* ${totalDistanceKm.toFixed(1)} km | 📦 *Entregas:* ${totalDeliveredCount}/${totalStopsCount}\n\n`;

  msg += `========================================\n`;
  msg += `💵 *TOTAL COBRADO ACUMULADO:* ${formatCurrency(grandTotalCollect)}\n`;
  msg += `⛽ *TOTAL VIÁTICOS ACUMULADOS:* ${formatCurrency(grandTotalAllowance)}\n`;
  msg += `💰 *BALANCE GENERAL A ENTREGAR:* ${formatCurrency(grandNetBalance)}\n`;
  msg += `========================================\n\n`;

  msg += `📋 *DESGLOSE DETALLADO POR RUTA:*\n\n`;

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

    msg += `🔹 *RUTA ${idx + 1}: ${label}*\n`;
    msg += `   • 🚘 *Vehículo:* ${r.mode.toUpperCase()} | 📏 *Distancia:* ${distStr} | ⏱️ *Duración:* ${durStr}\n`;
    msg += `   • 💵 *Cobro:* ${formatCurrency(rCollect)} | ⛽ *Viáticos:* ${formatCurrency(rAllowance)} | 💰 *Balance:* *${formatCurrency(rBalance)}*\n`;
    msg += `   • *Paradas (${r.stopsDelivered}/${r.stopsTotal}):*\n`;

    if (stops.length === 0) {
      msg += `     (Sin desglose de paradas)\n`;
    } else {
      stops.forEach((s, sIdx) => {
        const statusIcon = s.delivered ? "✅" : "⏳";
        const timeStr = s.deliveredAt ? `[${formatDateShort(s.deliveredAt)}] ` : "";
        msg += `     ${statusIcon} ${sIdx + 1}. ${timeStr}${s.label}`;
        
        const extras: string[] = [];
        if (typeof s.collectAmount === "number" && s.collectAmount > 0) extras.push(`💵 ${formatCurrency(s.collectAmount)}`);
        if (typeof s.travelAllowance === "number" && s.travelAllowance > 0) extras.push(`⛽ ${formatCurrency(s.travelAllowance)}`);
        if (s.notes) extras.push(`📝 ${s.notes}`);

        if (extras.length > 0) {
          msg += ` (${extras.join(" | ")})`;
        }
        msg += `\n`;
      });
    }
    msg += `\n`;
  });

  msg += `🚀 *Generado desde RutaFácil*`;
  return msg;
}

/**
 * Genera el mensaje de WhatsApp para despachar un pedido con Smart Link y emojis en el chat.
 */
export function generateWhatsAppDispatchText(data: {
  geoUrl: string;
  label: string;
  kind?: "delivery" | "pickup";
  collectAmount?: number;
  travelAllowance?: number;
  notes?: string;
  assignee?: string;
}): string {
  const { geoUrl, label, kind = "delivery", collectAmount, travelAllowance, notes, assignee } = data;

  const header = kind === "pickup" ? "🏬 *NUEVA RECOGIDA ASIGNADA*" : "📦 *NUEVA ENTREGA ASIGNADA*";
  let msg = `${header}\n`;
  if (assignee) msg += `👤 *Repartidor:* @${assignee}\n`;
  msg += `📍 *Dirección:* ${label}\n`;
  if (typeof collectAmount === "number" && collectAmount > 0) {
    const amountLabel = kind === "pickup" ? "💵 *Recoger del cliente:*" : "💵 *Entregar al cliente:*";
    msg += `${amountLabel} ${formatCurrency(collectAmount)}\n`;
  }
  if (typeof travelAllowance === "number" && travelAllowance > 0) {
    msg += `⛽ *Viáticos asignados:* ${formatCurrency(travelAllowance)}\n`;
  }
  if (notes) {
    msg += `📝 *Notas:* ${notes}\n`;
  }

  msg += `\n👉 *Toca para cargar en RutaFácil:*\n${geoUrl}`;
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
