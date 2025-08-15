import React, { useState } from 'react'

function formatUSPhoneMask(v: string) {
  const d = (v.match(/\d/g) || []).join('').slice(0,10);
  const a = d.slice(0,3);
  const b = d.slice(3,6);
  const c = d.slice(6,10);
  if (d.length > 6) return `(${a}) ${b}-${c}`;
  if (d.length > 3) return `(${a}) ${b}`;
  if (d.length > 0) return `(${a}`;
  return '';
}

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

async function apiProcess(body: any) {
  const r = await fetch(`${BASE}/payments/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiRedeem(code: string, phone?: string) {
  const r = await fetch(`${BASE}/rewards/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, phone }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { ok: true, value, phone }
}

export default function Payments() {
  const [amount, setAmount] = useState<number>(10)
  const [showNewPhone, setShowNewPhone] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [result, setResult] = useState<any>(null)

  // Redemption UI state
  const [code, setCode] = useState('')
  const [discount, setDiscount] = useState<number>(0) // applied coupon value for current order

  const handleNewClick = () => setShowNewPhone(true)

  const confirmNew = async () => {
    if (!newPhone) return alert('Enter phone for new customer');
    const res = await apiProcess({ amount, flow: 'new', phone: newPhone })
    setResult(res)
    setShowNewPhone(false)
    setNewPhone('')
    setDiscount(0)
  }

  const handleReturning = async () => {
    const res = await apiProcess({ amount, flow: 'returning' })
    setResult(res)
    setDiscount(0)
  }

  const handlePayAndDistribute = async () => {
    const res = await apiProcess({ amount, flow: 'returningWithDistribute' })
    setResult(res)
    setDiscount(0)
  }

  const applyCode = async () => {
    if (!code) return alert('Enter a code');
    try {
      const res = await apiRedeem(code);      
      const value = Math.max(0, Math.min(res.value ?? 0, amount));
      setDiscount(value);
      setResult((prev: any) => ({ ...(prev || {}), redeem: res }));
      setCode('');
    } catch (err: any) {
      // Try to surface server JSON error
      try {
        const msg = JSON.parse(err.message)?.error || err.message;
        alert(`Redeem failed: ${msg}`);
      } catch {
        alert(`Redeem failed: ${err?.message || 'Unknown error'}`);
      }
    }
  };  

  const finalTotal = Math.max(0, amount - discount)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
      {/* Left column */}
      <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
        <h2>Payments + Issuance</h2>

        <label>Order total ($)
          <input type="number" value={amount} onChange={e=>setAmount(parseFloat(e.target.value||'0'))} />
        </label>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap:'wrap' }}>
          <button onClick={handleNewClick}>Payment: New Customer</button>
          <button onClick={handleReturning}>Payment: Returning Customer</button>
          <button onClick={handlePayAndDistribute}>Pay & Distribute</button>
        </div>

        {/* New customer phone prompt */}
        {showNewPhone && (
          <div style={{ border:'1px solid #ffe58f', background:'#fffbe6', padding: 12, borderRadius: 8 }}>
            <div>Enter phone to create wallet & issue points to a new customer.</div>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <input
                value={newPhone}
                onChange={e=>setNewPhone(formatUSPhoneMask(e.target.value))}
                placeholder="(555) 555-5555"
                inputMode="numeric"
              />
              <button onClick={confirmNew}>Confirm</button>
              <button onClick={()=>{ setShowNewPhone(false); setNewPhone(''); }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Redemption code box */}
        <div style={{ border:'1px solid #eee', padding: 12, borderRadius: 8 }}>
          <h3>Redeem coupon</h3>
          <div style={{ display:'flex', gap:8 }}>
            <input
              value={code}
              onChange={e=>setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              style={{ textTransform: 'uppercase' }}
            />
            <button onClick={applyCode}>Redeem</button>
          </div>
          <div style={{ marginTop: 8, display:'grid', gap:4 }}>
            <div>Discount applied: <b>${discount.toFixed(2)}</b></div>
            <div>Final total: <b>${finalTotal.toFixed(2)}</b></div>
          </div>
        </div>

        {/* Result + SMS */}
        {result && (
          <div style={{ border:'1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h3>Result</h3>
            <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
            {result?.coupon && <div><b>Redemption code:</b> {result.coupon} (also sent via SMS)</div>}
            {result?.sms?.length ? (
              <div style={{ marginTop: 8 }}>
                <h4>SMS sent</h4>
                <ul>
                  {result.sms.map((m: any, i: number) => (
                    <li key={i}><code>{m.to}</code>: {m.body}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Right column: one-sentence helper for each button */}
      <aside style={{ position: 'sticky', top: 12, border:'1px solid #eee', padding: 16, borderRadius: 8 }}>
        <h3>Button help</h3>
        <ul style={{ paddingLeft: 16, display:'grid', gap:8 }}>
          <li><b>Payment: New Customer</b> — prompts for a phone, creates a wallet, and issues points equal to the dollar amount.</li>
          <li><b>Payment: Returning Customer</b> - issues points equal to the dollar amount to the existing customer (matched by payment method and phone) and may text a coupon if the balance reaches the threshold.</li>
          <li><b>Pay & Distribute</b> — seeds the account so this order crosses the threshold and triggers a coupon; use an order of $5 or more.</li>
        </ul>
      </aside>
    </div>
  )
}
