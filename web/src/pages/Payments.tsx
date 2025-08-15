import React, { useState } from 'react'
import { issue, getRewards, createRedemption, redeem } from '../api'

export default function Payments() {
  const [phone, setPhone] = useState('')
  const [points, setPoints] = useState(1)
  const [balance, setBalance] = useState<number|undefined>(undefined)
  const [history, setHistory] = useState<any[]>([])
  const [code, setCode] = useState('')
  const [returningCode, setReturningCode] = useState<string|undefined>(undefined)

  const refresh = async () => {
    if (!phone) return
    const r = await getRewards(phone)
    setBalance(r.balance)
    setHistory(r.history || [])
  }

  const handleIssueNew = async () => {
    if (!phone) return alert('Enter phone')
    await issue(phone, points, `Welcome! You earned ${points} point(s).`)
    await refresh()
  }

  const handleReturning = async () => {
    if (!phone) return alert('Enter phone')
    const res = await createRedemption(phone, 0)
    setReturningCode(res.code)
  }

  const handleRedeem = async () => {
    if (!phone) return alert('Enter phone')
    if (!code) return alert('Enter code')
    await redeem(code, phone)
    await refresh()
    setCode('')
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2>Payments + Issuance</h2>
      <div style={{ display: 'grid', gap: 8, maxWidth: 460 }}>
        <label>Phone
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+15551234567" />
        </label>
        <label>Points to issue (new customer)
          <input type="number" value={points} onChange={e=>setPoints(parseInt(e.target.value||'0',10))} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleIssueNew}>Payment: New Customer</button>
          <button onClick={handleReturning}>Payment: Returning Customer</button>
        </div>
        {returningCode && <div>Redemption code for returning customer: <b>{returningCode}</b></div>}
      </div>

      <div style={{ display: 'grid', gap: 8, maxWidth: 460 }}>
        <h3>Redeem</h3>
        <label>Code
          <input value={code} onChange={e=>setCode(e.target.value)} placeholder="ABC123" />
        </label>
        <div>
          <button onClick={handleRedeem}>Verify & Apply</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <h3>Customer Balance</h3>
        <button onClick={refresh}>Refresh</button>
        <div>Balance: <b>{balance ?? 0}</b></div>
        <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #eee', padding: 8 }}>
          <pre>{JSON.stringify(history, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
