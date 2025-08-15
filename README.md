# SAS Loyalty Starter (Solana Attestation Service + SMS)

Tiny starter for issuing loyalty **points** and demoing **VIP tier** via Solana Attestation Service (SAS), with a clean SMS interface behind a pluggable provider (Twilio adapter included, stub enabled by default). **No databases**—simple, open-source starter.

## Features
- **Server**
  - `POST /rewards/issue` — issue points via SAS (mock by default) and send SMS
  - `GET /rewards/:phone` — read balance/history (from SAS mock or SDK when wired)
  - Pluggable `SmsProvider`: `stub` (default) or `twilio`
  - `SasClient`: `mock` (default) with typed interface; swap in real SAS SDK integration
  - Simple in-memory redemption codes for demo
- **Web**
  - Vite + React + TS
  - Two pages with left side-drawer:
    - **Payments + Issuance** (new/returning + redemption)
    - **Setup Attestations** (Punchcard configurable; Tier lines visible/demo-only)
- **Env**
  - `.env.example` provided; never commit secrets.

> This is a **starter**: the SAS client uses a mock in-memory implementation. Flip to real SDK once ready.

---

## Prereqs
- Node 18+ and PNPM or NPM/Yarn
- (Optional) Twilio account if you want real SMS
- (Optional) Solana CLI for keypair on **Devnet**

### Create a Devnet keypair (example)
```bash
solana-keygen new -o ~/.config/solana/id.json
solana config set --url https://api.devnet.solana.com
```

---

## Setup

### 1) Server
```bash
cd server
pnpm i        # or npm i / yarn
cp ../.env.example .env
pnpm dev      # starts on http://localhost:4000
```

### 2) Web
```bash
cd ../web
pnpm i
pnpm dev      # opens http://localhost:5173
```

---

## Environment (.env)
See `.env.example` for all keys. By default, **stub** SMS + **mock** SAS are used.

To send real SMS:
```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+1XXXXXXXXXX
```

To keep using stubs, leave `SMS_PROVIDER=stub` (default).

---

## Swap in real SAS
See `server/src/services/sas.ts`. Replace the mock with calls to the **Solana Attestation Service** SDK/client:
- `issuePointsAttestation(phone, points, metadata)`
- `getAttestations(phone)`

Keep the interface; replace the internals.

---

## Notes
- No DB by design. In-memory demo state resets on server restart.
- Privy wallet creation is **stubbed**; see `server/src/services/customers.ts`.
- Tier program UI is visible but **read-only** example in this starter.
- MIT License.
