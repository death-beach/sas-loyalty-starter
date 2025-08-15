import React, { useState } from 'react'
import Payments from './pages/Payments'
import Setup from './pages/Setup'

export default function App() {
  const [page, setPage] = useState<'payments'|'setup'>('payments')
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <aside style={{ width: 240, borderRight: '1px solid #eee', padding: 16 }}>
        <h3>SAS Loyalty</h3>
        <nav style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage('payments')}>Payments + Issuance</button>
          <button onClick={() => setPage('setup')}>Setup Attestations</button>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {page === 'payments' ? <Payments /> : <Setup />}
      </main>
    </div>
  )
}
