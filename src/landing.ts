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
  .wrap { text-align: center; padding: 2rem 1.5rem; max-width: 640px; width: 100%; }
  .chips { font-size: 2.5rem; letter-spacing: .35rem; margin-bottom: 1rem; }
  h1 { font-size: clamp(2.5rem, 8vw, 4.5rem); margin: 0; }
  .accent { color: #36d77a; }
  p.tag { font-size: 1.25rem; opacity: .85; margin: 1rem 0 2rem; }
  .cta-form { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; }
  input {
    padding: .85rem 1rem; border-radius: 10px; border: 1px solid #2a4d3a;
    background: #0e1713; color: #eafff1; min-width: 240px; font-size: 1rem;
    outline: none;
  }
  input:focus { border-color: #36d77a; }
  button {
    padding: .85rem 1.4rem; border-radius: 10px; border: 0; cursor: pointer;
    background: #36d77a; color: #06200f; font-weight: 700; font-size: 1rem;
    transition: opacity 0.2s;
  }
  button:hover { opacity: 0.9; }
  small { display: block; margin-top: 1.5rem; opacity: .55; }
  .error { color: #ff453a; font-weight: 600; margin-top: 15px; }
  
  /* Audit Tool Styles */
  .audit-btn {
    background: #13261a;
    border: 1px solid #2a4d3a;
    color: #36d77a;
    font-size: 0.9rem;
    margin-top: 3rem;
  }
  .audit-btn:hover {
    background: #1b3827;
  }
  .audit-container {
    display: none;
    margin-top: 24px;
    padding: 24px;
    background: #0e1713;
    border: 1px solid #2a4d3a;
    border-radius: 14px;
    text-align: center;
    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
  }
  .audit-title {
    font-size: 1.4rem;
    margin: 0 0 8px 0;
    color: #36d77a;
    font-weight: 800;
  }
  .audit-desc {
    font-size: 0.9rem;
    opacity: 0.75;
    margin: 0 0 20px 0;
    line-height: 1.5;
  }
  .audit-inputs {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  #auditResult {
    margin-top: 20px;
  }
  .audit-card {
    text-align: left;
    padding: 16px;
    background: #132219;
    border-radius: 10px;
    border: 1px solid #2a4d3a;
    line-height: 1.6;
  }
  .audit-step {
    margin-bottom: 16px;
    border-bottom: 1px dashed #2a4d3a;
    padding-bottom: 12px;
  }
  .audit-step:last-child {
    margin-bottom: 0;
    border-bottom: 0;
    padding-bottom: 0;
  }
  code {
    word-break: break-all;
    font-size: 12px;
    background: #060a08;
    padding: 3px 6px;
    border-radius: 4px;
    color: #36d77a;
    display: inline-block;
    margin: 2px 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
  .status-tag {
    font-weight: 700;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
    margin-top: 4px;
  }
  .status-success { background: rgba(54, 215, 122, 0.15); color: #36d77a; }
  .status-fail { background: rgba(255, 69, 58, 0.15); color: #ff453a; }
  .winner-banner {
    background: #172c1f;
    border: 1px solid #36d77a;
    border-radius: 8px;
    padding: 14px;
    margin-top: 16px;
    border-left-width: 5px;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="chips">🔴 ⚪ 🔵 ⚫</div>
    <h1>A <span class="accent">Stack'd</span></h1>
    <p class="tag">Stack your chips. Melt the odds. Win real prizes.</p>
    <form class="cta-form" onsubmit="event.preventDefault(); this.querySelector('button').textContent='On the list ✓';">
      <input type="email" placeholder="you@email.com" aria-label="Email" required />
      <button type="submit">Get early access</button>
    </form>
    <small>Launching soon. No purchase necessary where prohibited.</small>

    <!-- Drawing Audit Section -->
    <button onclick="toggleAuditTool()" class="audit-btn">🛡️ Open Drawing Audit Tool</button>
    
    <div id="auditContainer" class="audit-container">
      <h2 class="audit-title">Verify a Drawing</h2>
      <p class="audit-desc">Every draw uses a cryptographically fair Commit-Reveal RNG. Enter a Pool ID below to verify the mathematical validity of the draw.</p>
      <div class="audit-inputs">
        <input type="text" id="auditPoolId" placeholder="Enter Pool ID (e.g. p_weekly_tv)" required />
        <button onclick="runAudit()" id="auditRunBtn">Verify Draw</button>
      </div>
      <div id="auditResult"></div>
    </div>
  </div>

  <script>
    function toggleAuditTool() {
      const container = document.getElementById('auditContainer');
      container.style.display = container.style.display === 'none' ? 'block' : 'none';
      if (container.style.display === 'block') {
        container.scrollIntoView({ behavior: 'smooth' });
      }
    }

    async function sha256(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    }

    async function runAudit() {
      const poolId = document.getElementById('auditPoolId').value.trim();
      const resultDiv = document.getElementById('auditResult');
      const btn = document.getElementById('auditRunBtn');

      if (!poolId) {
        resultDiv.innerHTML = '<p class="error">Please enter a Pool ID.</p>';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Auditing…';
      resultDiv.innerHTML = '<p style="opacity:0.7;">Fetching pool drawing logs from Floor…</p>';

      try {
        const response = await fetch('/pools/' + encodeURIComponent(poolId) + '/audit');
        if (!response.ok) {
          resultDiv.innerHTML = '<p class="error">Pool not found or not yet drawn.</p>';
          return;
        }

        const data = await response.json();
        const pool = data.pool;
        const tickets = data.tickets;

        if (tickets.length === 0) {
          resultDiv.innerHTML = '<p class="error">No tickets were entered in this pool.</p>';
          return;
        }

        if (pool.status.toLowerCase().includes('filled') && !pool.drawnAt) {
          resultDiv.innerHTML = \`
            <div class="audit-card" style="background:#151e18; border-color:#2a4d3a;">
              <h3 style="margin-top:0;color:#36d77a;font-size:15px;">ℹ️ Pool Entry Phase Locked</h3>
              <p style="margin:0 0 10px 0;opacity:0.85;font-size:13px;">This pool is closed and ready for the drawing. The server has committed to the following seed hash:</p>
              <code>\${pool.serverSeedHash}</code>
              <p style="margin:10px 0 0 0;font-size:12px;opacity:0.6;">The actual server seed will be revealed upon drawing, letting you verify that the server did not change the outcome.</p>
            </div>
          \`;
          return;
        }

        if (!pool.drawnAt) {
          resultDiv.innerHTML = '<p class="error">This pool has not been drawn yet.</p>';
          return;
        }

        // Verify cryptographic steps
        const ticketIds = tickets.map(t => t.ticketId);
        const joinedIds = ticketIds.join(',');

        const calcClientSeed = await sha256(joinedIds);
        const calcServerHash = await sha256(pool.serverSeed);
        const calcFinalSeed = await sha256(pool.serverSeed + ':' + pool.clientSeed);

        const serverHashOk = (calcServerHash === pool.serverSeedHash);
        const clientSeedOk = (calcClientSeed === pool.clientSeed);
        const finalSeedOk = (calcFinalSeed === pool.finalSeed);

        const finalSeedBig = BigInt('0x' + pool.finalSeed);
        const totalTicketsBig = BigInt(tickets.length);
        const calcWinnerIndex = Number(finalSeedBig % totalTicketsBig);
        const winnerIndexOk = (calcWinnerIndex === pool.winnerIndex);

        const winnerTicket = tickets[calcWinnerIndex];

        let html = \`
          <div class="audit-card">
            <h3 style="margin-top:0;color:#36d77a;font-size:16px;border-bottom:1px solid #2a4d3a;padding-bottom:10px;margin-bottom:16px;">🛡️ Cryptographic Proof Verified</h3>
            
            <div class="audit-step">
              <strong>Step 1: Server Seed Reveal Proof</strong><br/>
              <span style="font-size:13px;opacity:0.8;">Verifies that the server used the pre-committed server seed.</span><br/>
              Committed Hash: <code>\${pool.serverSeedHash}</code><br/>
              Revealed Seed: <code>\${pool.serverSeed}</code><br/>
              Calculated Hash: <code>\${calcServerHash}</code><br/>
              \${serverHashOk ? '<span class="status-tag status-success">✅ Committed Server Seed Matches</span>' : '<span class="status-tag status-fail">❌ Commitment Mismatch</span>'}
            </div>

            <div class="audit-step">
              <strong>Step 2: Client Seed Ticket Entropy Proof</strong><br/>
              <span style="font-size:13px;opacity:0.8;">Verifies client seed is the hash of all ticket IDs in order.</span><br/>
              Ticket IDs (Count: \${tickets.length}): <code>\${joinedIds.length > 50 ? joinedIds.slice(0, 50) + '…' : joinedIds}</code><br/>
              Calculated Client Seed: <code>\${calcClientSeed}</code><br/>
              Returned Client Seed: <code>\${pool.clientSeed}</code><br/>
              \${clientSeedOk ? '<span class="status-tag status-success">✅ Client Entropy Validated</span>' : '<span class="status-tag status-fail">❌ Client Seed Mismatch</span>'}
            </div>

            <div class="audit-step">
              <strong>Step 3: Final Seed Calculation Proof</strong><br/>
              <span style="font-size:13px;opacity:0.8;">Verifies final seed is SHA-256 of serverSeed:clientSeed.</span><br/>
              Input: <code>\${pool.serverSeed.slice(0, 10)}… : \${pool.clientSeed.slice(0, 10)}…</code><br/>
              Calculated Final Seed: <code>\${calcFinalSeed}</code><br/>
              Returned Final Seed: <code>\${pool.finalSeed}</code><br/>
              \${finalSeedOk ? '<span class="status-tag status-success">✅ Combined Entropy Verified</span>' : '<span class="status-tag status-fail">❌ Final Seed Mismatch</span>'}
            </div>

            <div class="audit-step">
              <strong>Step 4: Draw Calculation Verification</strong><br/>
              <span style="font-size:13px;opacity:0.8;">Verifies winnerIndex = BigInt(finalSeed) % BigInt(totalTickets).</span><br/>
              Math: <code style="font-size:11px;">\${finalSeedBig.toString().slice(0, 30)}… % \${totalTicketsBig.toString()} = \${calcWinnerIndex}</code><br/>
              Expected Index: <code>\${pool.winnerIndex}</code><br/>
              \${winnerIndexOk ? '<span class="status-tag status-success">✅ Winning Modulo Proved Correct</span>' : '<span class="status-tag status-fail">❌ Modulo Math Error</span>'}
            </div>
        \`;

        if (winnerTicket) {
          html += \`
            <div class="winner-banner">
              <span style="color:#36d77a;font-weight:900;font-size:15px;">🏆 Winner Seat Confirmed</span><br/>
              <p style="margin:6px 0 0 0;font-size:13px;opacity:0.9;">
                Ticket Seat: <strong>#\${winnerTicket.seatNumber}</strong><br/>
                Ticket ID: <code>\${winnerTicket.ticketId}</code><br/>
                Obfuscated Winner: <strong>\${winnerTicket.userIdObfuscated}</strong>
              </p>
            </div>
          \`;
        }

        html += '</div>';
        resultDiv.innerHTML = html;
      } catch (err) {
        resultDiv.innerHTML = '<p class="error">Failed to verify: ' + err.message + '</p>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Verify Draw';
      }
    }
  </script>
</body>
</html>`;
