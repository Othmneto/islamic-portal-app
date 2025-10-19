// /public/moon.js — works with pill IDs (m-*) and/or card IDs (moon-*)
(function () {
  // ---- helpers ----
  const $ = id => document.getElementById(id);
  const refs = {
    status: $('m-status'),
    // pill layout
    phase: $('m-phase'),
    illum: $('m-illum'),
    age: $('m-age'),
    rise: $('m-rise'),
    set:  $('m-set'),
    dist: $('m-dist'),
    // card layout
    visual: $('moon-visual'),
    details: $('moon-details'),
  };

  function fmtTime(d) {
    const t = new Date(d);
    return isNaN(t) ? '—' : t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  // Prefer illumination near new/full; use phase between
  function phaseLabel(phase, fraction) {
    if (fraction >= 0.985) return { name: 'Full Moon', icon: '🌕' };
    if (fraction <= 0.015) return { name: 'New Moon',  icon: '🌑' };
    if (phase < 0.25)        return { name: 'Waxing Crescent', icon: '🌒' };
    if (phase < 0.28)        return { name: 'First Quarter',   icon: '🌓' };
    if (phase < 0.5)         return { name: 'Waxing Gibbous',  icon: '🌔' };
    if (phase < 0.53)        return { name: 'Full Moon',       icon: '🌕' };
    if (phase < 0.75)        return { name: 'Waning Gibbous',  icon: '🌖' };
    if (phase < 0.78)        return { name: 'Last Quarter',    icon: '🌗' };
    return { name: 'Waning Crescent', icon: '🌘' };
  }

  function setText(el, value) { if (el) el.textContent = value; }

  function update(lat, lon) {
    if (!window.SunCalc) {
      setText(refs.status, 'SunCalc failed to load');
      return;
    }

    const now = new Date();
    const ill   = SunCalc.getMoonIllumination(now);       // { fraction, phase, angle }
    const pos   = SunCalc.getMoonPosition(now, lat, lon); // { azimuth, altitude, distance, parallacticAngle }
    const times = SunCalc.getMoonTimes(now, lat, lon);    // local times; may be undefined

    const label = phaseLabel(ill.phase, ill.fraction);
    const cycle = 29.530588853;
    const ageDays = (ill.phase * cycle).toFixed(1);
    const fracPct = (ill.fraction * 100).toFixed(1);
    const distanceKm = Math.round(pos.distance).toLocaleString();

    // pill layout
    setText(refs.phase, label.name);
    setText(refs.illum, `${fracPct}%`);
    setText(refs.age, `${ageDays} days`);
    setText(refs.rise, times.rise ? fmtTime(times.rise) : (times.alwaysUp ? 'Always up' : times.alwaysDown ? 'Always down' : '—'));
    setText(refs.set,  times.set  ? fmtTime(times.set)  : (times.alwaysUp ? 'Always up' : times.alwaysDown ? 'Always down' : '—'));
    setText(refs.dist, `${distanceKm}`);

    // card layout
    setText(refs.details, `${label.name}, ${fracPct}% illumination`);
    setText(refs.visual, label.icon);
  }

  function fallback() { return { lat: 25.2048, lon: 55.2708, label: 'Dubai, UAE (Default)' }; }

  function start() {
    // If the library is deferred, wait a tick to be safe
    const run = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const lat = pos.coords.latitude, lon = pos.coords.longitude;
            setText(refs.status, `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
            update(lat, lon);
          },
          () => {
            const d = fallback();
            setText(refs.status, `Using ${d.label}`);
            update(d.lat, d.lon);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        const d = fallback();
        setText(refs.status, `Geolocation unavailable — ${d.label}`);
        update(d.lat, d.lon);
      }
    };

    // If SunCalc is loaded with defer, this is fine.
    // If you removed defer and it loads late, retry a couple times.
    if (window.SunCalc) run();
    else {
      let tries = 0;
      const id = setInterval(() => {
        if (window.SunCalc || tries++ > 20) { clearInterval(id); run(); }
      }, 100);
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start)
    : start();
})();
