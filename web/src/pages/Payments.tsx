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
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<any>(null)

  const handleNew = async () => {
    if (!phone) return alert('Enter phone for new customer');
    const res = await apiProcess({ amount, flow: 'new', phone })
    setResult(res)
  }

  const handleReturning = async () => {
    if (!phone) return alert('Enter phone for returning customer')
    const res = await apiProcess({ amount, flow: 'returning', phone })
    setResult(res)
  }

  const handlePayAndDistribute = async () => {
    if (!phone) return alert('Enter phone')
    const res = await apiProcess({ amount, flow: 'returningWithDistribute', phone })
    setResult(res)
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      <h2>Payments + Issuance</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>Order total ($)
          <input type="number" value={amount} onChange={e=>setAmount(parseFloat(e.target.value||'0'))} />
        </label>

        <label>Phone
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+15551234567" />
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap:'wrap' }}>
          <button onClick={handleNew}>Payment: New Customer</button>
          <button onClick={handleReturning}>Payment: Returning Customer</button>
          <button onClick={handlePayAndDistribute}>Pay & Distribute (seed 95 + this order)</button>
        </div>
      </div>

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