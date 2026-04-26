// Netlify Edge Function â password-gates /newshub and /newshub/*
// Set NH_PASSWORD in Netlify â Site settings â Environment variables

const COOKIE_NAME = 'nh_sess';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export default async function (request, context) {
  const password = Deno.env.get('NH_PASSWORD');

  // No password configured â allow through
  if (!password) return context.next();

  const expectedToken = await deriveToken(password);
  const url = new URL(request.url);
  const cookies = parseCookies(request.headers.get('cookie') || '');

  // Already authenticated
  if (cookies[COOKIE_NAME] === expectedToken) {
    return context.next();
  }

  // Handle login form POST
  if (request.method === 'POST') {
    try {
      const form = await request.formData();
      const submitted = form.get('password') || '';
      if (submitted === password) {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': url.pathname + url.search,
            'Set-Cookie': `${COOKIE_NAME}=${expectedToken}; Path=/newshub; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`,
          },
        });
      }
    } catch {
      // fall through to show form with error
    }
    return loginPage(url.pathname, true);
  }

  // Show login page
  return loginPage(url.pathname, false);
}

// Derive a stable token from the password using SHA-256
async function deriveToken(password) {
  const data = new TextEncoder().encode('newshub:' + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseCookies(header) {
  const out = {};
  for (const part of header.split(';')) {
    const [k, ...vs] = part.trim().split('=');
    if (k) out[k.trim()] = vs.join('=').trim();
  }
  return out;
}

function loginPage(action, error) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NewsHub â Sign In</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f1117;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #e2e8f0;
    }
    .card {
      width: 100%;
      max-width: 360px;
      padding: 2.5rem 2rem;
      background: #1a1d27;
      border: 1px solid #2d3148;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .logo {
      text-align: center;
      margin-bottom: 2rem;
    }
    .logo-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 0.5rem;
    }
    .logo h1 {
      font-size: 1.4rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
    }
    .logo p {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 0.25rem;
    }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 0.4rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    input[type="password"] {
      width: 100%;
      padding: 0.7rem 0.9rem;
      background: #0f1117;
      border: 1px solid ${error ? '#ef4444' : '#2d3148'};
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="password"]:focus {
      border-color: #6366f1;
    }
    .error {
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: #ef4444;
    }
    button {
      margin-top: 1.25rem;
      width: 100%;
      padding: 0.75rem;
      background: #6366f1;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #4f46e5; }
    button:active { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <span class="logo-icon">ð°</span>
      <h1>NewsHub</h1>
      <p>Enter your password to continue</p>
    </div>
    <form method="POST" action="${action}">
      <label for="pw">Password</label>
      <input id="pw" type="password" name="password" autofocus autocomplete="current-password" placeholder="â¢â¢â¢â¢â¢â¢â¢â¢">
      ${error ? '<p class="error">Incorrect password â try again.</p>' : ''}
      <button type="submit">Sign In â</button>
    </form>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: error ? 401 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export const config = { path: ['/newshub', '/newshub/*'] };
