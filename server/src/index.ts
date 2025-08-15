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
    if (!phone || !points) return res.status(400).json({ error: 'phone and points required' });

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
    // For demo: deduct 1 point if available
    await sas.issuePointsAttestation(phone, -1, { reason: 'redeem-demo' });
    res.json({ ok: true });
  } catch (e:any) {
    res.status(500).json({ error: e?.message || 'redeem failed' });
  }
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
