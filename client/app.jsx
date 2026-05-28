import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

const API = '';

async function req(path, method, body) {
  const r = await fetch(API + path, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || JSON.stringify(d));
  return d;
}

const TRADING = '0xE10848d47ca32e10447a8CAaaA309F5A593323f8';

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f5f5f4; --surface: #fff; --surface2: #f9f9f8;
    --border: rgba(0,0,0,0.1); --text: #1a1a18; --text2: #6b6b67;
    --accent: #1a1a18; --accent-fg: #fff; --radius: 10px; --radius-sm: 6px;
    --green: #639922; --red: #e24b4a; --blue: #0c447c; --blue-bg: #e6f1fb;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1c1c1a; --surface: #252523; --surface2: #2c2c2a;
      --border: rgba(255,255,255,0.1); --text: #f0efe8; --text2: #9b9b96;
      --accent: #f0efe8; --accent-fg: #1a1a18;
      --blue: #b5d4f4; --blue-bg: #042c53;
    }
  }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); padding-bottom: 4rem; }
  header { background: var(--surface); border-bottom: 0.5px solid var(--border); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 10; }
  header h1 { font-size: 17px; font-weight: 500; }
  .pill { font-size: 11px; padding: 3px 9px; border-radius: 99px; background: var(--blue-bg); color: var(--blue); margin-left: auto; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 1.25rem; }
  .status { display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; transition: background .3s; }
  .card { background: var(--surface); border: 0.5px solid var(--border); border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1rem; }
  .card-title { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: .05em; color: var(--text2); margin-bottom: .75rem; }
  .addr { font-size: 12px; font-family: monospace; background: var(--surface2); border-radius: var(--radius-sm); padding: .75rem; word-break: break-all; color: var(--text2); margin-bottom: .75rem; }
  .trading { font-size: 12px; font-family: monospace; background: var(--surface2); border-radius: var(--radius-sm); padding: .75rem; word-break: break-all; color: var(--green); margin-bottom: .75rem; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  label { font-size: 13px; color: var(--text2); display: block; margin-bottom: 5px; }
  input, textarea { width: 100%; font-size: 14px; padding: 10px 12px; border: 0.5px solid var(--border); border-radius: var(--radius-sm); background: var(--surface2); color: var(--text); outline: none; -webkit-appearance: none; font-family: inherit; margin-bottom: .85rem; }
  input:focus, textarea:focus { border-color: var(--accent); }
  .btn { display: inline-flex; align-items: center; gap: 5px; font-size: 14px; font-weight: 500; padding: 10px 16px; border-radius: var(--radius-sm); border: 0.5px solid var(--border); background: transparent; color: var(--text); cursor: pointer; font-family: inherit; white-space: nowrap; -webkit-appearance: none; }
  .btn:active { opacity: .7; }
  .btn-p { background: var(--accent); color: var(--accent-fg); border-color: transparent; width: 100%; justify-content: center; }
  .tabs { display: flex; border-bottom: 0.5px solid var(--border); margin-bottom: 1rem; }
  .tab { flex: 1; font-size: 14px; padding: 10px 4px; border: none; background: transparent; color: var(--text2); cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; }
  .tab.on { color: var(--text); font-weight: 500; border-bottom-color: var(--text); }
  .out { margin-top: .75rem; font-size: 12px; font-family: monospace; background: var(--surface2); border-radius: var(--radius-sm); padding: .75rem; white-space: pre-wrap; word-break: break-all; line-height: 1.6; }
  .out.ok { border-left: 3px solid var(--green); }
  .out.err { border-left: 3px solid var(--red); }
  .log-entry { padding: .6rem .75rem; border-bottom: 0.5px solid var(--border); font-size: 12px; font-family: monospace; line-height: 1.5; }
  .log-entry:last-child { border-bottom: none; }
  .log-time { color: var(--text2); font-size: 11px; }
  .log-SUCCESS { color: var(--green); }
  .log-ERROR { color: var(--red); }
  .log-AGENT { color: var(--blue); }
  .log-WEBHOOK, .log-TEST { color: var(--text2); }
  .empty { padding: 1rem; text-align: center; color: var(--text2); font-size: 13px; }
  a { color: var(--blue); }
`;

function App() {
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState('Connecting…');
  const [address, setAddress] = useState('');
  const [tab, setTab] = useState('send');
  const [ethTo, setEthTo] = useState('');
  const [ethAmt, setEthAmt] = useState('');
  const [signMsg, setSignMsg] = useState('');
  const [sendOut, setSendOut] = useState(null);
  const [signOut, setSignOut] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => { ping(); }, []);
  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab]);

  async function ping() {
    try {
      const d = await req('/health');
      if (d.status === 'ok' || d.paused === false) {
        setConnected(true);
        setStatusText('Connected ✓ — agent active');
        loadWallet();
        loadLogs();
      }
    } catch (e) {
      setStatusText('❌ ' + e.message);
    }
  }

  async function loadWallet() {
    try {
      const d = await req('/wallet');
      setAddress(d.address);
    } catch (e) {
      setAddress('⚠️ ' + e.message);
    }
  }

  async function loadLogs() {
    try {
      const d = await req('/logs');
      setLogs(d);
    } catch (e) {}
  }

  async function sendEth() {
    if (!ethTo || !ethAmt) { setSendOut({ text: '⚠️ Fill in both fields.', type: 'err' }); return; }
    setSendOut({ text: '⏳ Sending…', type: 'ok' });
    try {
      const d = await req('/wallet/send-eth', 'POST', { to: ethTo, amountEth: ethAmt });
      setSendOut({ text: '✅ Sent!\n' + d.explorer, type: 'ok' });
      setTimeout(loadLogs, 2000);
    } catch (e) { setSendOut({ text: '❌ ' + e.message, type: 'err' }); }
  }

  async function doSign() {
    if (!signMsg) { setSignOut({ text: '⚠️ Enter a message.', type: 'err' }); return; }
    setSignOut({ text: '⏳ Signing…', type: 'ok' });
    try {
      const d = await req('/wallet/sign', 'POST', { message: signMsg });
      setSignOut({ text: '✅ Signed!\n' + d.signature, type: 'ok' });
    } catch (e) { setSignOut({ text: '❌ ' + e.message, type: 'err' }); }
  }

  return (
    <>
      <style>{styles}</style>
      <header>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <path d="M16 12h.01"/>
        </svg>
        <h1>Claude Agent Wallet</h1>
        <span className="pill">⬡ Ethereum mainnet</span>
      </header>

      <div className="wrap">
        <div className="status">
          <span className="dot" style={{ background: connected ? 'var(--green)' : 'var(--red)' }}></span>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{statusText}</span>
        </div>

        <div className="card">
          <div className="card-title">Agent wallet</div>
          <div className="addr">{address || '—'}</div>
          <div className="card-title" style={{ marginTop: '.5rem' }}>Auto-forwards to</div>
          <div className="trading">{TRADING}</div>
          <div className="row">
            <button className="btn" onClick={loadWallet}>↻ Refresh</button>
            {address && !address.startsWith('⚠️') && (
              <a href={'https://etherscan.io/address/' + address} target="_blank" className="btn">↗ Etherscan</a>
            )}
          </div>
        </div>

        <div className="card">
          <div className="tabs">
            {['send', 'sign', 'logs'].map((t, i) => (
              <button key={t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
                {['Send ETH', 'Sign', 'Activity log'][i]}
              </button>
            ))}
          </div>

          {tab === 'send' && (
            <div>
              <label>Recipient address</label>
              <input value={ethTo} onChange={e => setEthTo(e.target.value)} placeholder="0x..." autoCorrect="off" autoCapitalize="none" spellCheck="false" />
              <label>Amount (ETH)</label>
              <input type="number" value={ethAmt} onChange={e => setEthAmt(e.target.value)} placeholder="0.01" step="any" inputMode="decimal" />
              <button className="btn btn-p" onClick={sendEth}>Send ETH</button>
              {sendOut && <div className={'out ' + sendOut.type}>{sendOut.text}</div>}
            </div>
          )}

          {tab === 'sign' && (
            <div>
              <label>Message</label>
              <textarea value={signMsg} onChange={e => setSignMsg(e.target.value)} rows={4} placeholder="I approve this action…" />
              <button className="btn btn-p" onClick={doSign}>Sign message</button>
              {signOut && <div className={'out ' + signOut.type}>{signOut.text}</div>}
            </div>
          )}

          {tab === 'logs' && (
            <div>
              <div className="row" style={{ marginBottom: '.75rem' }}>
                <button className="btn" onClick={loadLogs}>↻ Refresh logs</button>
              </div>
              {logs.length === 0
                ? <div className="empty">No activity yet</div>
                : logs.map((l, i) => (
                  <div key={i} className="log-entry">
                    <div className={'log-' + l.type}>{l.type} — {l.message}</div>
                    {l.data && <div style={{ color: 'var(--text2)', fontSize: 11, marginTop: 2 }}>{JSON.stringify(l.data)}</div>}
                    <div className="log-time">{new Date(l.time).toLocaleString()}</div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
