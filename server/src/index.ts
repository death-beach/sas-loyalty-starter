import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createSmsProvider } from './services/sms.js';
import { createSasClient } from './services/sas.js';
import { customers } from './services/customers.js';
import { RedemptionCodes } from './services/redemption.js';
import { deriveCredentialPda, deriveSchemaPda, getCreateCredentialInstruction, getCreateSchemaInstruction } from 'sas-lib'
import { createSolanaClient, createTransaction } from 'gill'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { Keypair, clusterApiUrl } from '@solana/web3.js'
import { address, type Address } from '@solana/addresses'
import { SignatureBytes } from '@solana/keys'

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const sms = createSmsProvider(process.env.SMS_PROVIDER || 'stub');
const sas = createSasClient(process.env.USE_MOCK_SAS !== 'false');
const redemptions = new RedemptionCodes();
const DEMO_RETURNING_PHONE = process.env.DEMO_RETURNING_PHONE || '5551234567';

function normalizeUSPhone(input: string) {
  if (typeof input !== 'string') throw new Error('invalid phone format; use (555) 555-5555');
  const m = input.match(/^\(\d{3}\)\s?\d{3}-\d{4}$/);
  if (!m) throw new Error('invalid phone format; use (555) 555-5555');
  const digits = (input.match(/\d/g) || []).join(''); // 10 digits guaranteed by regex
  return `${digits}`; // internal E.164
}

type PointsConfig = {
  pointsName: string;
  programName: string;
  rewardType: 'percent_off' | 'dollars_off';
  rewardValue: number;      // e.g. 10 (% or $)
  dollarsSpent: number;     // e.g. 100
  rewardMode: 'Disabled' | 'Points Only' | 'Tiers Only' | 'Both';
};
let pointsConfig: PointsConfig = {
  pointsName: 'Points',
  programName: 'Loyalty',
  rewardType: 'dollars_off',
  rewardValue: Number(process.env.COUPON_VALUE || 10),
  dollarsSpent: Number(process.env.COUPON_THRESHOLD || 100),
  rewardMode: 'Points Only',
};

app.get('/config/points', (_req, res) => res.json(pointsConfig));

app.post('/config/points', (req, res) => {
  const { pointsName, programName, rewardType, rewardValue, dollarsSpent, rewardMode } = req.body || {};
  if (!pointsName || !programName || !rewardType || rewardValue == null || dollarsSpent == null || !rewardMode) {
    return res.status(400).json({ error: 'missing fields' });
  }
  pointsConfig = { pointsName, programName, rewardType, rewardValue: Number(rewardValue), dollarsSpent: Number(dollarsSpent), rewardMode };
  // Map to demo coupon behavior
  if (pointsConfig.rewardType === 'dollars_off') {
    (process.env as any).COUPON_VALUE = String(pointsConfig.rewardValue);
    (process.env as any).COUPON_THRESHOLD = String(pointsConfig.dollarsSpent); // 1 pt = $1
  }
  res.json({ ok: true, pointsConfig });
});


app.get('/health', (_req, res) => res.json({ ok: true }));

// Issue points + SMS (simple punchcard-style issuance demo)
app.post('/rewards/issue', async (req, res) => {
  try {
    const { phone, points, message } = req.body as { phone?: string; points: number; message?: string };
    if (points === undefined) return res.status(400).json({ error: 'points required' });

    const smsOut: { to: string; body: string }[] = [];
    const toPhone = normalizeUSPhone(phone || DEMO_RETURNING_PHONE);

    const attestation = await sas.issuePointsAttestation(toPhone, points, { reason: 'purchase' });
    const text = message ?? `You earned ${points} ${pointsConfig.pointsName} point(s). Balance: ${attestation.balance}.`;
    await sms.send(toPhone, text);
    smsOut.push({ to: toPhone, body: text });

    res.json({ ok: true, attestation, phone: toPhone, sms: smsOut });
  } catch (e:any) {
    console.error(e);
    res.status(400).json({ error: e?.message || 'issue failed' });
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
    const { code, phone } = req.body as { code: string; phone?: string };
    if (!code) return res.status(400).json({ error: 'code required' });

    const usePhone = normalizeUSPhone(phone || DEMO_RETURNING_PHONE);
    const value = redemptions.verifyAndConsume(code, usePhone);
    if (value == null) return res.status(400).json({ error: 'invalid or consumed code' });

    // (Starter leaves points unchanged on redeem.)
    res.json({ ok: true, value, phone: usePhone });
  } catch (e:any) {
    res.status(400).json({ error: e?.message || 'redeem failed' });
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
    const smsOut: { to: string; body: string }[] = [];

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return res.status(400).json({ error: 'valid amount required' });
    const pts = Math.floor(amt); // 1 pt per $1

    if (flow === 'new') {
      if (!phone) return res.status(400).json({ error: 'phone required for new customer' });
      const toPhone = normalizeUSPhone(phone);
      await customers.ensureWalletForPhone(toPhone);
      const link = `${WEB_BASE}/login?phone=${encodeURIComponent(toPhone)}`;
      {
        const body = `Welcome to the program! View your points: ${link}`;
        await sms.send(toPhone, body);
        smsOut.push({ to: toPhone, body });
      }
      const att = await sas.issuePointsAttestation(toPhone, pts, { reason: 'purchase-new' });
      const coupon = await maybeCreateCoupon(toPhone);
      if (coupon) {
        const body = `Your $${COUPON_VALUE} off code: ${coupon}. View points: ${link}`;
        await sms.send(toPhone, body);
        smsOut.push({ to: toPhone, body });
      }
      return res.json({ ok: true, pointsAdded: pts, coupon, att, phone: toPhone, sms: smsOut });
    }

    if (flow === 'returning') {
      const usePhone = normalizeUSPhone(phone || DEMO_RETURNING_PHONE);
      const att = await sas.issuePointsAttestation(usePhone, pts, { reason: 'purchase-returning' });
      const coupon = await maybeCreateCoupon(usePhone);
      {
        const bal = (await sas.getAttestations(usePhone)).balance;
        const body = `You earned ${pts} ${pointsConfig.pointsName} point(s). Balance: ${bal}.`;
        await sms.send(usePhone, body);
        smsOut.push({ to: usePhone, body });
      }
      if (coupon) {
        const link = `${WEB_BASE}/login?phone=${encodeURIComponent(usePhone)}`;
        const body = `Your $${COUPON_VALUE} off code: ${coupon}. View points: ${link}`;
        await sms.send(usePhone, body);
        smsOut.push({ to: usePhone, body });
      }
      return res.json({ ok: true, pointsAdded: pts, coupon, att, phone: usePhone, sms: smsOut });
    }

    if (flow === 'returningWithDistribute') {
      const usePhone = normalizeUSPhone(phone || DEMO_RETURNING_PHONE);
      await sas.issuePointsAttestation(usePhone, 95, { reason: 'seed-demo' });
      const att = await sas.issuePointsAttestation(usePhone, pts, { reason: 'purchase-returning' });
      const coupon = await maybeCreateCoupon(usePhone);
      {
        const bal = (await sas.getAttestations(usePhone)).balance;
        const body = `You earned ${pts} ${pointsConfig.pointsName} point(s). Balance: ${bal}.`;
        await sms.send(usePhone, body);
        smsOut.push({ to: usePhone, body });
      }
      if (coupon) {
        const link = `${WEB_BASE}/login?phone=${encodeURIComponent(usePhone)}`;
        const body = `Your $${COUPON_VALUE} off code: ${coupon}. View points: ${link}`;
        await sms.send(usePhone, body);
        smsOut.push({ to: usePhone, body });
      }
      return res.json({ ok: true, pointsAdded: pts, seeded: 95, coupon, att, phone: usePhone, sms: smsOut });
    }

    return res.status(400).json({ error: 'invalid flow' });
  } catch (e:any) {
    console.error(e);
    res.status(400).json({ error: e?.message || 'payment processing failed' });
  }
});

app.post('/sas/setup', async (req, res) => {
  try {
    const { credentialName, schemaName, description } = req.body as { credentialName?: string; schemaName?: string; description?: string }
    const bs58mod = bs58
    const url = process.env.SOLANA_DEVNET_RPC_URL || clusterApiUrl('devnet')
    const client = createSolanaClient({ urlOrMoniker: url })

    const payerSecret = process.env.PAYER_SECRET_KEY
    if (!payerSecret) return res.status(400).json({ error: 'PAYER_SECRET_KEY missing' })
    const kp = Keypair.fromSecretKey(bs58mod.decode(payerSecret))
    const signer = {
      address: kp.publicKey.toBase58() as Address,
      signTransactions: async (txs: any[]) => {
        const sigs: Readonly<Record<Address, SignatureBytes>>[] = []
        for (const tx of txs) {
          const sig = nacl.sign.detached(tx.messageBytes as unknown as Uint8Array, kp.secretKey)
          sigs.push({ [kp.publicKey.toBase58() as Address]: sig as SignatureBytes })
        }
        return sigs
      }
    }

    const credName = credentialName || `SAS-Cred-${Date.now()}`
    const schName = schemaName || 'Points'
    const layout = Buffer.from([4]) // u32
    const fields = ['points']
    const desc = description || 'Points balance attestation (u32)'

    const [credPda] = await deriveCredentialPda({ authority: signer.address, name: credName })
    const [schemaPda] = await deriveSchemaPda({ credential: credPda, name: schName, version: 1 })

    const i1 = getCreateCredentialInstruction({
      payer: signer, credential: credPda, authority: signer, name: credName, signers: [signer.address]
    })
    const i2 = getCreateSchemaInstruction({
      authority: signer, payer: signer, name: schName, credential: credPda, description: desc, fieldNames: fields, schema: schemaPda, layout
    })

    const latest = await client.rpc.getLatestBlockhash().send()
    const tx = createTransaction({
      version: 'legacy',
      feePayer: signer.address,
      instructions: [i1, i2],
      latestBlockhash: latest.value,
      computeUnitLimit: 1_400_000,
      computeUnitPrice: 1,
    })
    const sig = await client.sendAndConfirmTransaction(tx, { skipPreflight: true, commitment: 'confirmed' })

    // Surface PDAs so you can copy them into env for future runs
    res.json({
      ok: true,
      credentialPda: credPda.toString(),
      schemaPda: schemaPda.toString(),
      signature: sig
    })
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: e?.message || 'setup failed' })
  }
})

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
