import React, { useState } from 'react'

export default function Setup() {
  // Punchcard (configurable)
  const [punchEvery, setPunchEvery] = useState(10) // e.g., free after 10
  const [punchReward, setPunchReward] = useState('Free coffee')

  // Tiers (visible but demo-only here)
  const tiers = [
    { name: 'Silver', threshold: 500, perk: '15% off', nft: 'Silver Tier NFT (demo-only)' },
    { name: 'Gold', threshold: 1000, perk: '25% off', nft: 'Gold Tier NFT (demo-only)' },
  ]

  const save = () => {
    alert(`Saved punchcard: every ${punchEvery}, reward: ${punchReward}\n(Tier setup is demo-only in starter)`)
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      <h2>Setup Attestations</h2>

      <section style={{ border: '1px solid #eee', padding: 16, borderRadius: 8 }}>
        <h3>Punchcard (configurable)</h3>
        <label>Stamp every N purchases<input type="number" value={punchEvery} onChange={e=>setPunchEvery(parseInt(e.target.value||'0',10))} /></label>
        <label>Reward text<input value={punchReward} onChange={e=>setPunchReward(e.target.value)} /></label>
        <p style={{ color:'#666' }}>This creates an initial **non-tokenized** SAS credential in the real integration.</p>
        <button onClick={save}>Save</button>
      </section>

      <section style={{ border: '1px solid #eee', padding: 16, borderRadius: 8 }}>
        <h3>Tiered Spend (demo-only)</h3>
        <p style={{ color:'#666' }}>Visible example; in a full version, tiers mint/airdrop NFTs when thresholds are hit.</p>
        <ul>
          {tiers.map(t => <li key={t.name}><b>{t.name}</b>: ≥${t.threshold} • {t.perk} • {t.nft}</li>)}
        </ul>
      </section>
    </div>
  )
}
