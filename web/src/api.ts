const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export async function issue(phone: string, points: number, message?: string) {
  const r = await fetch(`${BASE}/rewards/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, points, message }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getRewards(phone: string) {
  const r = await fetch(`${BASE}/rewards/${phone}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createRedemption(phone: string, amount: number) {
  const r = await fetch(`${BASE}/rewards/${phone}/redemption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function redeem(code: string, phone: string) {
  const r = await fetch(`${BASE}/rewards/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, phone }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
