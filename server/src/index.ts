import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createSmsProvider } from './services/sms.js';
import { createSasClient } from './services/sas.js';
import { customers } from './services/customers.js';
import { RedemptionCodes } from './services/redemption.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const sms = createSmsProvider(process.env.SMS_PROVIDER || 'stub');
const sas = createSasClient(process.env.USE_MOCK_SAS !== 'false');
const redemptions = new RedemptionCodes();

app.get('/health', (_req, res) => res.json({ ok: true }));

// Issue points + SMS (simple punchcard-style issuance demo)
app.post('/rewards/issue', async (req, res) => {
  try {
    const { phone, points, message } = req.body as { phone: string; points: number; message?: string };
    if (!phone || points === undefined) return res.status(400).json({ error: 'phone and points required' });

    const attestation = await sas.issuePointsAttestation(phone, points, { reason: 'purchase' });
    const text = message ?? `You earned ${points} point(s). Balance: ${attestation.balance}.`;
    await sms.send(phone, text);
    res.json({ ok: true, attestation });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e?.message || 'issue failed' });
  }
});

// Get balance/history
app.get('/rewards/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;
    const data = await sas.getAttestations(phone);
    res.json(data);
  } catch (e:any) {
    res.status(500).json({ error: e?.message || 'read failed' });
  }
});

// Create redemption code for returning customer
app.post('/rewards/:phone/redemption', async (req, res) => {
  try {
    const { amount } = req.body as { amount: number };
    const code = redemptions.create(amount || 0, req.params.phone);
    res.json({ code });
  } catch (e:any) {
    res.status(500).json({ error: e?.message || 'redemption create failed' });
  }
});

// Verify & apply redemption
app.post('/rewards/redeem', async (req, res) => {
  try {
    const { code, phone } = req.body as { code: string; phone: string };
    const ok = redemptions.verifyAndConsume(code, phone);
    if (!ok) return res.status(400).json({ error: 'invalid or consumed code' });
    await sas.issuePointsAttestation(phone, -1, { reason: 'redeem-demo' });
    res.json({ ok: true });
  } catch (e:any) {
    res.status(500).json({ error: e?.message || 'redeem failed' });
  }
});

// ---------- Amount → Points + Coupon helpers ----------
const COUPON_THRESHOLD = Number(process.env.COUPON_THRESHOLD || 100); // points threshold
const COUPON_VALUE = Number(process.env.COUPON_VALUE || 10); // $ off
const WEB_BASE = process.env.WEB_BASE || 'http://localhost:5173';

function dollarsToPoints(amount: number) {
  return Math.floor(amount); // 1 pt per $1
}

async function maybeCreateCoupon(phone: string) {
  const { balance } = await sas.getAttestations(phone);
  if (balance >= COUPON_THRESHOLD) {
    const code = redemptions.create(COUPON_VALUE, phone);
    const link = `${WEB_BASE}/login?phone=${encodeURIComponent(phone)}`;
    const body = `Your $${COUPON_VALUE} off code: ${code}. View points: ${link}`;
    await sms.send(phone, body);
    return code;
  }
  return null;
}

/**
 * POST /payments/process
 * Body: { amount: number, flow: 'new'|'returning'|'returningWithDistribute', phone?: string }
 */
app.post('/payments/process', async (req, res) => {
  try {
    const { amount, flow, phone } = req.body as {
      amount: number; flow: 'new'|'returning'|'returningWithDistribute'; phone?: string
    };
    if (typeof amount !== 'number' || amount < 0) return res.status(400).json({ error: 'valid amount required' });
    const pts = dollarsToPoints(amount);

    if (flow === 'new') {
      if (!phone) return res.status(400).json({ error: 'phone required for new customer' });
      await customers.ensureWalletForPhone(phone);
      const link = `${WEB_BASE}/login?phone=${encodeURIComponent(phone)}`;
      await sms.send(phone, `Welcome to the program! View your points: ${link}`);
      const att = await sas.issuePointsAttestation(phone, pts, { reason: 'purchase-new' });
      const coupon = await maybeCreateCoupon(phone);
      return res.json({ ok: true, pointsAdded: pts, coupon, att });
    }

    if (flow === 'returning') {
      if (!phone) return res.status(400).json({ error: 'phone required for returning customer' });
      const att = await sas.issuePointsAttestation(phone, pts, { reason: 'purchase-returning' });
      const coupon = await maybeCreateCoupon(phone);
      await sms.send(phone, `You earned ${pts} point(s). Balance: ${(await sas.getAttestations(phone)).balance}.`);
      return res.json({ ok: true, pointsAdded: pts, coupon, att });
    }

    if (flow === 'returningWithDistribute') {
      if (!phone) return res.status(400).json({ error: 'phone required for returningWithDistribute' });
      await sas.issuePointsAttestation(phone, 95, { reason: 'seed-demo' });
      const att = await sas.issuePointsAttestation(phone, pts, { reason: 'purchase-returning' });
      const coupon = await maybeCreateCoupon(phone);
      await sms.send(phone, `You earned ${pts} point(s). Balance: ${(await sas.getAttestations(phone)).balance}.`);
      return res.json({ ok: true, pointsAdded: pts, seeded: 95, coupon, att });
    }

    return res.status(400).json({ error: 'invalid flow' });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e?.message || 'payment processing failed' });
  }
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
