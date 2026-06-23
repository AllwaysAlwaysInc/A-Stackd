/** Minimal "buzz" landing page so the domain has something live on day one. */
export const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>A Stack'd — Stack your chips. Melt the odds.</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: radial-gradient(1200px 600px at 50% -10%, #1b3a2a, #0b0f0d 60%);
    color: #eafff1;
  }
  .wrap { text-align: center; padding: 2rem; max-width: 640px; }
  .chips { font-size: 2.5rem; letter-spacing: .35rem; margin-bottom: 1rem; }
  h1 { font-size: clamp(2.5rem, 8vw, 4.5rem); margin: 0; }
  .accent { color: #36d77a; }
  p.tag { font-size: 1.25rem; opacity: .85; margin: 1rem 0 2rem; }
  form { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; }
  input {
    padding: .85rem 1rem; border-radius: 10px; border: 1px solid #2a4d3a;
    background: #0e1713; color: #eafff1; min-width: 240px; font-size: 1rem;
  }
  button {
    padding: .85rem 1.4rem; border-radius: 10px; border: 0; cursor: pointer;
    background: #36d77a; color: #06200f; font-weight: 700; font-size: 1rem;
  }
  small { display: block; margin-top: 1.5rem; opacity: .55; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="chips">\uD83D\uDD34 \u26AA \uD83D\uDD35 \u26AB</div>
    <h1>A <span class="accent">Stack'd</span></h1>
    <p class="tag">Stack your chips. Melt the odds. Win real prizes.</p>
    <form onsubmit="event.preventDefault(); this.querySelector('button').textContent='On the list \u2713';">
      <input type="email" placeholder="you@email.com" aria-label="Email" required />
      <button type="submit">Get early access</button>
    </form>
    <small>Launching soon. No purchase necessary where prohibited.</small>
  </div>
</body>
</html>`;
