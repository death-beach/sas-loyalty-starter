import { Buffer } from 'buffer' // for tokenized
import bs58 from 'bs58'
import nacl from 'tweetnacl'
import { Keypair, clusterApiUrl } from '@solana/web3.js'
import {
  createSolanaClient, createTransaction, type SolanaClient, type TransactionSigner, type Transaction
} from 'gill'
import {
  getCreateCredentialInstruction, // for tokenized
  getCreateSchemaInstruction, // for tokenized
  fetchSchema,
  fetchAttestation,
  deriveCredentialPda,
  deriveSchemaPda,
  deriveAttestationPda,
  serializeAttestationData,
  deserializeAttestationData,
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS,
  deriveEventAuthorityAddress
} from 'sas-lib'
import { address, type Address } from '@solana/addresses'
import { SignatureBytes } from '@solana/keys'

export interface SasClient {
  issuePointsAttestation(phone: string, delta: number, meta?: Record<string, any>): Promise<{ phone: string; delta: number; balance: number; ts: number; meta?: any }>
  getAttestations(phone: string): Promise<{ balance: number; history: Array<{ delta: number; ts: number; meta?: any }> }>
}

const USE_MOCK = process.env.USE_MOCK_SAS !== 'false'

// ------------------------------ MOCK (existing) --------------------------------
class MockSasClient implements SasClient {
  private store = new Map<string, { balance: number; history: Array<{ delta: number; ts: number; meta?: any }> }>()
  async issuePointsAttestation(phone: string, delta: number, meta?: any) {
    const v = this.store.get(phone) || { balance: 0, history: [] }
    v.balance += delta
    v.history.push({ delta, ts: Date.now(), meta })
    this.store.set(phone, v)
    return { phone, delta, balance: v.balance, ts: Date.now(), meta }
  }
  async getAttestations(phone: string) {
    return this.store.get(phone) || { balance: 0, history: [] }
  }
}

// ------------------------------ REAL (devnet) ----------------------------------
// Minimal in-memory config for the starter (paste PDAs after /sas/setup)
let CREDENTIAL_PDA: string | undefined = process.env.SAS_CREDENTIAL_PDA
let SCHEMA_PDA: string | undefined = process.env.SAS_SCHEMA_PDA

// Deterministic nonce from phone for demo (maps to a synthetic ed25519 public key)
function demoNonceFromPhone(phone: string): Address {
  const digits = (phone.match(/\d/g) || []).join('')
  const seed = new TextEncoder().encode('sas-demo:' + digits)
  // Stretch to 32 bytes
  const hash = nacl.hash(seed).slice(0, 32)
  const kp = nacl.sign.keyPair.fromSeed(hash) // publicKey is 32 bytes
  // bs58 encode public key to look like an Address (no private key used on-chain)
  return bs58.encode(kp.publicKey) as Address
}

function getClient(): SolanaClient {
  const url = process.env.SOLANA_DEVNET_RPC_URL || clusterApiUrl('devnet')
  return createSolanaClient({ urlOrMoniker: url })
}

function getPayer(): { kp: Keypair; signer: TransactionSigner } {
  const secret = process.env.PAYER_SECRET_KEY
  if (!secret) throw new Error('PAYER_SECRET_KEY missing')
  const kp = Keypair.fromSecretKey(bs58.decode(secret))
  const signer: TransactionSigner = {
    address: kp.publicKey.toBase58() as Address,
    signTransactions: async (txs: Transaction[]) => {
      const sigs: Readonly<Record<Address, SignatureBytes>>[] = []
      for (const tx of txs) {
        const sig = nacl.sign.detached(tx.messageBytes as unknown as Uint8Array, kp.secretKey)
        sigs.push({ [kp.publicKey.toBase58() as Address]: sig as SignatureBytes })
      }
      return sigs
    },
  }
  return { kp, signer }
}

async function ensureSetup(): Promise<{ client: SolanaClient; signer: TransactionSigner; credential: Address; schema: Address }> {
  if (!CREDENTIAL_PDA || !SCHEMA_PDA) {
    throw new Error('SAS not set up. Call POST /sas/setup first and put SAS_CREDENTIAL_PDA & SAS_SCHEMA_PDA into env.')
  }
  const client = getClient()
  const { signer } = getPayer()
  return { client, signer, credential: CREDENTIAL_PDA as Address, schema: SCHEMA_PDA as Address }
}

class RealSasClient implements SasClient {
  async issuePointsAttestation(phone: string, delta: number, meta?: any) {
    const { client, signer, credential, schema } = await ensureSetup()

    // Read current points
    const nonce = demoNonceFromPhone(phone)
    const [attestationPda] = await deriveAttestationPda({
      credential: address(credential),
      schema: address(schema),
      nonce,
    })

    // Try fetch current attestation; if exists, we’ll “close & recreate” with new points
    let current = 0
    try {
      const att = await fetchAttestation(client.rpc, attestationPda)
      const sc = await fetchSchema(client.rpc, schema)
      const parsed = deserializeAttestationData(sc.data, att.data.data as Uint8Array) as { points: number }
      current = Number(parsed.points) || 0
    } catch {
      // not found is fine
    }

    const newTotal = Math.max(0, current + delta)

    // Close existing (if any) then create new with updated points
    const eventAuthority = await deriveEventAuthorityAddress()
    const attProg = SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS

    const instructions: any[] = []
    if (current > 0) {
      const { getCloseAttestationInstruction } = await import('sas-lib')
      instructions.push(
        getCloseAttestationInstruction({
          payer: signer, authority: signer,
          credential: address(credential),
          attestation: attestationPda,
          eventAuthority,
          attestationProgram: attProg,
        })
      )
    }
    const sc = await fetchSchema(client.rpc, schema)
    const data = serializeAttestationData(sc.data, { points: newTotal })

    const { getCreateAttestationInstruction } = await import('sas-lib')
    instructions.push(
      getCreateAttestationInstruction({
        payer: signer, authority: signer,
        credential: address(credential),
        schema: address(schema),
        attestation: attestationPda,
        nonce,
        expiry: BigInt(0),
        data,
      })
    )

    const latest = await client.rpc.getLatestBlockhash().send()
    const tx = createTransaction({
      version: 'legacy',
      feePayer: signer.address,
      instructions,
      latestBlockhash: latest.value,
      computeUnitLimit: 1_400_000,
      computeUnitPrice: 1,
    })
    await client.sendAndConfirmTransaction(tx, { skipPreflight: true, commitment: 'confirmed' })
    return { phone, delta, balance: newTotal, ts: Date.now(), meta }
  }

  async getAttestations(phone: string) {
    const { client } = await ensureSetup()
    const nonce = demoNonceFromPhone(phone)
    const credential = CREDENTIAL_PDA as Address
    const schema = SCHEMA_PDA as Address
    const [attestationPda] = await deriveAttestationPda({
      credential: address(credential),
      schema: address(schema),
      nonce,
    })
    try {
      const att = await fetchAttestation(client.rpc, attestationPda)
      const sc = await fetchSchema(client.rpc, schema)
      const parsed = deserializeAttestationData(sc.data, att.data.data as Uint8Array) as { points: number }
      const balance = Number(parsed.points) || 0
      return { balance, history: [] }
    } catch {
      return { balance: 0, history: [] }
    }
  }
}

// ------------------------------ Factory ----------------------------------------
export function createSasClient(useMock: boolean): SasClient {
  if (useMock) return new MockSasClient()
  return new RealSasClient()
}
