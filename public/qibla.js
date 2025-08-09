// Qibla card (moved from Prayer Time)
(function(){
  const KAABA = { lat: 21.4225, lon: 39.8262 };
  const R = 6371; // km

  const el = id => document.getElementById(id);
  const statusEl   = el('q-status');
  const bearingEl  = el('q-bearing');
  const distanceEl = el('q-distance');
  const needle     = el('q-needle');

  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;

  function initialBearing(from, to){
    const φ1 = toRad(from.lat), φ2 = toRad(to.lat);
    const Δλ = toRad(to.lon - from.lon);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ) + Math.sin(φ1) * Math.sin(φ2);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  function haversine(a, b){
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function updateUI(bearing, distance){
    bearingEl.textContent  = bearing.toFixed(1);
    distanceEl.textContent = Math.round(distance).toLocaleString();
    needle.style.transform = `rotate(${bearing}deg)`;
  }
  function fallback(){ return { lat:25.2048, lon:55.2708, label:'Dubai, UAE (Default)' }; }

  if (navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      const me = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      statusEl.textContent = `Your location: ${me.lat.toFixed(4)}, ${me.lon.toFixed(4)}`;
      updateUI(initialBearing(me, KAABA), haversine(me, KAABA));
    }, _=>{
      const d=fallback(); statusEl.textContent=`Using ${d.label}`;
      updateUI(initialBearing(d, KAABA), haversine(d, KAABA));
    }, { enableHighAccuracy:true, timeout:10000 });
  } else {
    const d=fallback(); statusEl.textContent=`Geolocation unavailable — ${d.label}`;
    updateUI(initialBearing(d, KAABA), haversine(d, KAABA));
  }
})();
