import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrivyClient, generateP256KeyPair } from '@privy-io/node';

const app = express();
app.use(cors());
app.use(express.json());

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ─── Generate keypair (run once to get your keys) ─────────────────────────────
app.get('/setup/keypair', async (_, res) => {
  try {
    const { privateKey, publicKey } = await generateP256KeyPair();
    res.json({
      info: 'Copy these into Railway Variables then redeploy',
      PRIVY_AUTH_PUBLIC_KEY: publicKey,
      PRIVY_AUTH_PRIVATE_KEY: privateKey,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Privy helpers ────────────────────────────────────────────────────────────
function privy() {
  return new PrivyClient({
    appId: process.env.PRIVY_APP_ID,
    appSecret: process.env.PRIVY_APP_SECRET,
  });
}

function walletId() {
  const id = process.env.PRIVY_WALLET_ID;
  if (!id) throw new Error('PRIVY_WALLET_ID not set in Railway variables');
  return id;
}

function authPrivateKey() {
  const key = process.env.PRIVY_AUTH_PRIVATE_KEY;
  if (!key) throw new Error('PRIVY_AUTH_PRIVATE_KEY not set in Railway variables');
  return key;
}

// ─── Create wallet ────────────────────────────────────────────────────────────
app.post('/wallet/create', async (_, res) => {
  try {
    const publicKey = process.env.PRIVY_AUTH_PUBLIC_KEY;
    if (!publicKey) return res.status(400).json({ error: 'PRIVY_AUTH_PUBLIC_KEY not set' });
    const wallet = await privy().wallets().create({
      chain_type: 'ethereum',
      owner: { public_key: publicKey },
    });
    res.json({
      walletId: wallet.id,
      address: wallet.address,
      message: 'Save walletId as PRIVY_WALLET_ID in Railway variables!',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Get wallet ───────────────────────────────────────────────────────────────
app.get('/wallet', async (_, res) => {
  try {
    const wallet = await privy().wallets().get(walletId());
    res.json({ walletId: wallet.id, address: wallet.address });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Send ETH ─────────────────────────────────────────────────────────────────
app.post('/wallet/send-eth', async (req, res) => {
  try {
    const { to, amountEth } = req.body;
    if (!to || !amountEth) return res.status(400).json({ error: 'Missing: to, amountEth' });
    const value = '0x' + BigInt(Math.round(parseFloat(amountEth) * 1e18)).toString(16);
    const response = await privy().wallets().ethereum().sendTransaction(walletId(), {
      caip2: 'eip155:1',
      params: {
        transaction: { to, value, chain_id: 1 },
      },
      authorization_context: {
        authorization_private_keys: [authPrivateKey()],
      },
    });
    res.json({
      txHash: response.hash,
      explorer: 'https://etherscan.io/tx/' + response.hash,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Sign message ─────────────────────────────────────────────────────────────
app.post('/wallet/sign', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing: message' });
    const response = await privy().wallets().ethereum().signMessage(walletId(), {
      message,
      authorization_context: {
        authorization_private_keys: [authPrivateKey()],
      },
    });
    res.json({ signature: response.signature });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Dashboard UI ─────────────────────────────────────────────────────────────
app.get('/', (_, res) => res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Claude Agent Wallet</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#f5f5f4;--surface:#fff;--surface2:#f9f9f8;
      --border:rgba(0,0,0,0.1);--text:#1a1a18;--text2:#6b6b67;
      --accent:#1a1a18;--accent-fg:#fff;--radius:10px;--radius-sm:6px;
      --green:#639922;--red:#e24b4a;--blue:#0c447c;--blue-bg:#e6f1fb;
    }
    @media(prefers-color-scheme:dark){:root{
      --bg:#1c1c1a;--surface:#252523;--surface2:#2c2c2a;
      --border:rgba(255,255,255,0.1);--text:#f0efe8;--text2:#9b9b96;
      --accent:#f0efe8;--accent-fg:#1a1a18;
      --blue:#b5d4f4;--blue-bg:#042c53;
    }}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);padding-bottom:4rem}
    header{background:var(--surface);border-bottom:0.5px solid var(--border);padding:1rem 1.25rem;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:10}
    header h1{font-size:17px;font-weight:500}
    .pill{font-size:11px;padding:3px 9px;border-radius:99px;background:var(--blue-bg);color:var(--blue);margin-left:auto}
    .wrap{max-width:560px;margin:0 auto;padding:1.25rem}
    .status{display:flex;align-items:center;gap:8px;margin-bottom:1rem}
    .dot{width:8px;height:8px;border-radius:50%;background:var(--red);flex-shrink:0}
    .dot.on{background:var(--green)}
    .card{background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius);padding:1.25rem;margin-bottom:1rem}
    .label{font-size:12px;color:var(--text2);margin-bottom:6px}
    .addr{font-size:12px;font-family:monospace;background:var(--surface2);border-radius:var(--radius-sm);padding:.75rem;word-break:break-all;color:var(--text2);margin-bottom:.75rem}
    .row{display:flex;gap:8px;flex-wrap:wrap}
    label{font-size:13px;color:var(--text2);display:block;margin-bottom:5px}
    input,textarea{width:100%;font-size:14px;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--radius-sm);background:var(--surface2);color:var(--text);outline:none;-webkit-appearance:none;font-family:inherit;margin-bottom:.85rem}
    input:focus,textarea:focus{border-color:var(--accent)}
    .btn{display:inline-flex;align-items:center;gap:5px;font-size:14px;font-weight:500;padding:10px 16px;border-radius:var(--radius-sm);border:0.5px solid var(--border);background:transparent;color:var(--text);cursor:pointer;font-family:inherit;-webkit-appearance:none;white-space:nowrap}
    .btn:active{opacity:.7}
    .btn-p{background:var(--accent);color:var(--accent-fg);border-color:transparent;width:100%;justify-content:center}
    .tabs{display:flex;border-bottom:0.5px solid var(--border);margin-bottom:1rem}
    .tab{flex:1;font-size:14px;padding:10px 4px;border:none;background:transparent;color:var(--text2);cursor:pointer;border-bottom:2px solid transparent;font-family:inherit}
    .tab.on{color:var(--text);font-weight:500;border-bottom-color:var(--text)}
    .panel{display:none}.panel.on{display:block}
    .out{margin-top:.75rem;font-size:12px;font-family:monospace;background:var(--surface2);border-radius:var(--radius-sm);padding:.75rem;white-space:pre-wrap;word-break:break-all;line-height:1.6;display:none}
    .out.show{display:block}
    .out.ok{border-left:3px solid var(--green)}
    .out.err{border-left:3px solid var(--red)}
    a{color:var(--blue)}
  </style>
</head>
<body>
<header>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <path d="M16 12h.01"/>
  </svg>
  <h1>Claude Agent Wallet</h1>
  <span class="pill">⬡ Ethereum mainnet</span>
</header>

<div class="wrap">

  <div class="status">
    <span class="dot" id="dot"></span>
    <span id="st" style="font-size:13px;color:var(--text2)">Connecting…</span>
  </div>

  <div class="card">
    <div class="label">Wallet address</div>
    <div class="addr" id="addr">—</div>
    <div class="row">
      <button class="btn" onclick="loadWallet()">↻ Refresh</button>
      <a id="scan" href="#" target="_blank" class="btn" style="display:none">↗ Etherscan</a>
      <button class="btn" onclick="createWallet()">+ Create wallet</button>
    </div>
    <div id="create-out" class="out"></div>
  </div>

  <div class="card">
    <div class="tabs">
      <button class="tab on" onclick="tab('eth')">Send ETH</button>
      <button class="tab" onclick="tab('sign')">Sign message</button>
    </div>

    <div id="p-eth" class="panel on">
      <label>Recipient address</label>
      <input id="eth-to" type="text" placeholder="0x..." autocorrect="off" autocapitalize="none" spellcheck="false"/>
      <label>Amount (ETH)</label>
      <input id="eth-amt" type="number" placeholder="0.01" step="any" inputmode="decimal"/>
      <button class="btn btn-p" onclick="sendEth()">Send ETH</button>
      <div id="eth-out" class="out"></div>
    </div>

    <div id="p-sign" class="panel">
      <label>Message</label>
      <textarea id="sign-msg" rows="4" placeholder="I approve this action…"></textarea>
      <button class="btn btn-p" onclick="signMsg()">Sign message</button>
      <div id="sign-out" class="out"></div>
    </div>
  </div>

</div>

<script>
  async function req(path, method, body) {
    const r = await fetch(path, {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || JSON.stringify(d));
    return d;
  }

  async function ping() {
    try {
      await req('/health');
      document.getElementById('dot').classList.add('on');
      document.getElementById('st').textContent = 'Connected ✓';
      loadWallet();
    } catch (e) {
      document.getElementById('st').textContent = '❌ ' + e.message;
    }
  }

  async function loadWallet() {
    try {
      const d = await req('/wallet');
      document.getElementById('addr').textContent = d.address;
      const s = document.getElementById('scan');
      s.href = 'https://etherscan.io/address/' + d.address;
      s.style.display = 'inline-flex';
    } catch (e) {
      document.getElementById('addr').textContent = '⚠️ ' + e.message;
    }
  }

  async function createWallet() {
    out('create-out', '⏳ Creating…', 'ok');
    try {
      const d = await req('/wallet/create', 'POST');
      out('create-out',
        '✅ Wallet created!\n' +
        'ID: ' + d.walletId + '\n' +
        'Address: ' + d.address + '\n\n' +
        '⚠️ Add PRIVY_WALLET_ID to Railway variables!', 'ok');
    } catch (e) { out('create-out', '❌ ' + e.message, 'err'); }
  }

  async function sendEth() {
    const to  = document.getElementById('eth-to').value.trim();
    const amt = document.getElementById('eth-amt').value.trim();
    if (!to || !amt) { out('eth-out', '⚠️ Fill in both fields.', 'err'); return; }
    out('eth-out', '⏳ Sending…', 'ok');
    try {
      const d = await req('/wallet/send-eth', 'POST', { to, amountEth: amt });
      out('eth-out', '✅ Sent!\n' + d.explorer, 'ok');
    } catch (e) { out('eth-out', '❌ ' + e.message, 'err'); }
  }

  async function signMsg() {
    const msg = document.getElementById('sign-msg').value.trim();
    if (!msg) { out('sign-out', '⚠️ Enter a message.', 'err'); return; }
    out('sign-out', '⏳ Signing…', 'ok');
    try {
      const d = await req('/wallet/sign', 'POST', { message: msg });
      out('sign-out', '✅ Signed!\n' + d.signature, 'ok');
    } catch (e) { out('sign-out', '❌ ' + e.message, 'err'); }
  }

  function out(id, text, type) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'out show ' + type;
  }

  function tab(name) {
    document.querySelectorAll('.tab').forEach((t, i) =>
      t.classList.toggle('on', ['eth', 'sign'][i] === name));
    document.querySelectorAll('.panel').forEach(p =>
      p.classList.toggle('on', p.id === 'p-' + name));
  }

  ping();
</script>
</body>
</html>`));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🚀 Claude Agent Wallet on port ' + PORT));
