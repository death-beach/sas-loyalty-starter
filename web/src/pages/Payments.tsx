import React, { useState } from 'react'

async function apiProcess(body: any) {
  const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
  const r = await fetch(`${BASE}/payments/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function Payments() {
  const [amount, setAmount] = useState<number>(10)
  const [showNewPhone, setShowNewPhone] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [result, setResult] = useState<any>(null)

  const handleNewClick = () => setShowNewPhone(true)

  const confirmNew = async () => {
    if (!newPhone) return alert('Enter phone for new customer');
    const res = await apiProcess({ amount, flow: 'new', phone: newPhone })
    setResult(res)
    setShowNewPhone(false)
    setNewPhone('')
  }

  const handleReturning = async () => {
    const res = await apiProcess({ amount, flow: 'returning' }) // phone resolved on server
    setResult(res)
  }

  const handlePayAndDistribute = async () => {
    const res = await apiProcess({ amount, flow: 'returningWithDistribute' }) // phone resolved on server
    setResult(res)
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      <h2>Payments + Issuance</h2>
      <label>Order total ($)
        <input type="number" value={amount} onChange={e=>setAmount(parseFloat(e.target.value||'0'))} />
      </label>

      <div style={{ display: 'flex', gap: 8, flexWrap:'wrap' }}>
        <button onClick={handleNewClick}>Payment: New Customer</button>
        <button onClick={handleReturning}>Payment: Returning Customer</button>
        <button onClick={handlePayAndDistribute}>Pay & Distribute (seed 95 + this order)</button>
      </div>

      {showNewPhone && (
        <div style={{ border:'1px solid #ffe58f', background:'#fffbe6', padding: 12, borderRadius: 8 }}>
          <div>Enter phone to create wallet & issue points to a new customer.</div>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="+15551234567" />
            <button onClick={confirmNew}>Confirm</button>
            <button onClick={()=>{ setShowNewPhone(false); setNewPhone(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {result && (
        <div style={{ border:'1px solid #eee', padding: 12, borderRadius: 8 }}>
          <h3>Result</h3>
          <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
          {result?.coupon && <div><b>Redemption code:</b> {result.coupon} (also sent via SMS)</div>}
        </div>
      )}
    </div>
  )
}