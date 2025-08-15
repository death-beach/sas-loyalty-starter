import React, { useEffect, useState } from 'react'

async function getConfig() {
  const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
  const r = await fetch(`${BASE}/config/points`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function saveConfig(body: any) {
  const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
  const r = await fetch(`${BASE}/config/points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function Setup() {
  const [pointsName, setPointsName] = useState('Points')
  const [programName, setProgramName] = useState('Loyalty')
  const [rewardType, setRewardType] = useState<'percent_off'|'dollars_off'>('dollars_off')
  const [rewardValue, setRewardValue] = useState<number>(10)
  const [dollarsSpent, setDollarsSpent] = useState<number>(100)
  const [rewardMode, setRewardMode] = useState<'Disabled'|'Points Only'|'Tiers Only'|'Both'>('Points Only')

  useEffect(() => {
    getConfig().then(cfg => {
      setPointsName(cfg.pointsName ?? 'Points')
      setProgramName(cfg.programName ?? 'Loyalty')
      setRewardType(cfg.rewardType ?? 'dollars_off')
      setRewardValue(cfg.rewardValue ?? 10)
      setDollarsSpent(cfg.dollarsSpent ?? 100)
      setRewardMode(cfg.rewardMode ?? 'Points Only')
    }).catch(()=>{})
  }, [])

  const save = async () => {
    await saveConfig({ pointsName, programName, rewardType, rewardValue, dollarsSpent, rewardMode })
    alert('Saved. (Demo maps dollars_off to coupon logic: threshold=dollarsSpent, value=rewardValue)')
  }

  const tiers = [
    { name: 'Silver', threshold: 500, perk: '15% off', nft: 'Silver Tier NFT (demo-only)' },
    { name: 'Gold', threshold: 1000, perk: '25% off', nft: 'Gold Tier NFT (demo-only)' },
  ]

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
      <h2>Setup Attestations</h2>

      <section style={{ border: '1px solid #eee', padding: 16, borderRadius: 8 }}>
        <h3>Points Program</h3>
        <label>Points name<input value={pointsName} onChange={e=>setPointsName(e.target.value)} /></label>
        <label>Program name<input value={programName} onChange={e=>setProgramName(e.target.value)} /></label>
        <label>Reward type
          <select value={rewardType} onChange={e=>setRewardType(e.target.value as any)}>
            <option value="percent_off">% Off</option>
            <option value="dollars_off">$ Off</option>
          </select>
        </label>
        <label>Reward value ({rewardType === 'percent_off' ? '%' : '$'})
          <input type="number" value={rewardValue} onChange={e=>setRewardValue(parseFloat(e.target.value||'0'))} />
        </label>
        <label>Dollars spent to earn reward
          <input type="number" value={dollarsSpent} onChange={e=>setDollarsSpent(parseFloat(e.target.value||'0'))} />
        </label>
        <label>Reward mode
          <select value={rewardMode} onChange={e=>setRewardMode(e.target.value as any)}>
            <option>Disabled</option>
            <option>Points Only</option>
            <option>Tiers Only</option>
            <option>Both</option>
          </select>
        </label>
        <p style={{ color:'#666' }}>
          Demo behavior: if **$ Off**, the app maps “dollars spent” → points threshold and “reward value” → coupon value.
        </p>
        <button onClick={save}>Save</button>
      </section>

      <section style={{ border: '1px solid #eee', padding: 16, borderRadius: 8 }}>
        <h3>Tiered Spend (demo-only)</h3>
        <p style={{ color:'#666' }}>Visible example; full version mints/airdrops NFTs when thresholds are hit.</p>
        <ul>{tiers.map(t => <li key={t.name}><b>{t.name}</b>: ≥${t.threshold} • {t.perk} • {t.nft}</li>)}</ul>
      </section>
    </div>
  )
}