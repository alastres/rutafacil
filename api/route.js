const jwt = require('./_jwt');

const OSRM_PROFILE = {
  car: "driving",
  motorbike: "driving",
  bike: "bicycle",
  foot: "foot",
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { origin, stops, mode, returnPoint, optimize, timeoutMs = 12000 } = req.body;
  if (!origin || !stops || !Array.isArray(stops)) {
    return res.status(400).json({ error: 'Estructura de ruta inválida.' });
  }

  // 1. Extraer y verificar el JWT
  let userTier = 'free';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token);
    if (payload) {
      userTier = payload.tier;
    }
  }

  // 2. Aplicar límites de seguridad criptográficos en el Backend
  if (userTier === 'free') {
    if (stops.length > 8) {
      return res.status(403).json({ error: 'Límite del plan Gratuito alcanzado (máx. 8 paradas). Suscríbete a PRO.' });
    }
    if (returnPoint) {
      return res.status(403).json({ error: 'El punto de retorno es una característica exclusiva del plan PRO.' });
    }
  }

  // 3. Ruteo por calles (Llamada al ruteador OSRM)
  const profile = OSRM_PROFILE[mode || 'car'] || 'driving';
  const points = [origin, ...stops];
  if (returnPoint) {
    points.push(returnPoint);
  }

  const coordsString = points.map(p => `${p.lng},${p.lat}`).join(';');
  
  const apiType = optimize ? 'trip' : 'route';
  const tripParams = optimize 
    ? `?source=first&destination=${returnPoint ? 'last' : 'any'}&roundtrip=${returnPoint ? 'false' : 'true'}`
    : `?overview=full`;
    
  const url = `https://router.project-osrm.org/${apiType}/v1/${profile}/${coordsString}${tripParams}&geometries=geojson`;

  try {
    const fetchResponse = await fetch(url);
    if (!fetchResponse.ok) {
      throw new Error(`OSRM error: ${fetchResponse.status}`);
    }
    const data = await fetchResponse.json();
    
    if (data.code !== 'Ok') {
      return res.status(400).json({ error: 'No se pudo calcular la ruta.' });
    }

    if (optimize) {
      const trip = data.trips[0];
      const waypoints = data.waypoints || [];
      const sortedWaypoints = [...waypoints].sort((a, b) => a.trips_index - b.trips_index);
      
      const tripOrder = sortedWaypoints
        .map(w => w.waypoint_index - 1)
        .filter(idx => idx >= 0); // quitar el origen

      const returnIdx = stops.length;
      const finalOrder = tripOrder.filter(idx => idx !== returnIdx);

      const legsKm = trip.legs.map(l => l.distance / 1000);
      const returnLegKm = returnPoint ? legsKm[legsKm.length - 1] : undefined;

      return res.status(200).json({
        order: finalOrder,
        legsKm: returnPoint ? legsKm.slice(0, -1) : legsKm,
        distanceKm: trip.distance / 1000,
        durationMin: trip.duration / 60,
        coordinates: trip.geometry.coordinates,
        source: "osrm-backend-proxy",
        returnLegKm
      });
    } else {
      const route = data.routes[0];
      const legsKm = route.legs.map(l => l.distance / 1000);
      const returnLegKm = returnPoint ? legsKm[legsKm.length - 1] : undefined;
      const order = stops.map((_, idx) => idx);

      return res.status(200).json({
        order,
        legsKm: returnPoint ? legsKm.slice(0, -1) : legsKm,
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        coordinates: route.geometry.coordinates,
        source: "osrm-backend-proxy",
        returnLegKm
      });
    }
  } catch (err) {
    console.error("Fallo OSRM en proxy:", err);
    return res.status(502).json({ error: 'El servicio de rutas falló temporalmente.' });
  }
}
