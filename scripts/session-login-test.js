const fetch = require('node-fetch');

async function run() {
  const base = 'http://localhost:3000';

  function parseCookies(headers) {
    const setCookie = headers.raw()['set-cookie'] || [];
    const jar = {};
    setCookie.forEach((c) => {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      const name = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      if (name) jar[name] = val;
    });
    return jar;
  }

  function cookieHeader(jar) {
    return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  let jar = {};

  // 1) Get CSRF token
  const csrfRes = await fetch(`${base}/api/csrf-token`, {
    method: 'GET',
  });
  jar = { ...jar, ...parseCookies(csrfRes.headers) };
  const csrfJson = await csrfRes.json().catch(() => ({}));
  const csrfToken = csrfJson.csrfToken || '';
  console.log('CSRF Token:', csrfToken ? 'present' : 'missing');
  if (!csrfToken) throw new Error('Missing CSRF token');

  // 2) Login
  const loginBody = {
    email: 'Ahmedothmanofff@gmail.com',
    password: '@Ao0826479135',
    rememberMe: true,
  };
  const loginRes = await fetch(`${base}/api/auth-cookie/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      Cookie: cookieHeader(jar),
    },
    body: JSON.stringify(loginBody),
  });
  jar = { ...jar, ...parseCookies(loginRes.headers) };
  const loginJson = await loginRes.json().catch(() => ({}));
  console.log('Login status:', loginRes.status, loginJson.message || loginJson);

  // 3) Session status
  const sessRes = await fetch(`${base}/api/auth/session`, {
    headers: {
      Cookie: cookieHeader(jar),
    },
  });
  const sessJson = await sessRes.json().catch(() => ({}));
  console.log('Session:', sessJson);

  // 4) Logout
  const logoutRes = await fetch(`${base}/api/auth-cookie/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(jar),
    },
  });
  const logoutJson = await logoutRes.json().catch(() => ({}));
  console.log('Logout status:', logoutRes.status, logoutJson.message || logoutJson);

  // 5) Verify session cleared
  const sessRes2 = await fetch(`${base}/api/auth/session`, {
    headers: {
      Cookie: cookieHeader(jar),
    },
  });
  const sessJson2 = await sessRes2.json().catch(() => ({}));
  console.log('Session after logout:', sessJson2);
}

run().catch((e) => {
  console.error('Test failed:', e.message);
  process.exit(1);
});



