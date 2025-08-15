export type Attestation = {
  phone: string;
  delta: number;
  balance: number;
  ts: number;
  meta?: Record<string, any>;
};

export interface SasClient {
  issuePointsAttestation(phone: string, delta: number, meta?: Record<string, any>): Promise<Attestation>;
  getAttestations(phone: string): Promise<{ balance: number; history: Attestation[] }>;
}

// Mock implementation for starter repo (no DB)
class MockSasClient implements SasClient {
  private balances = new Map<string, number>();
  private histories = new Map<string, Attestation[]>();
  async issuePointsAttestation(phone: string, delta: number, meta?: Record<string, any>): Promise<Attestation> {
    const now = Date.now();
    const prev = this.balances.get(phone) || 0;
    const next = prev + delta;
    this.balances.set(phone, next);
    const att: Attestation = { phone, delta, balance: next, ts: now, meta };
    const h = this.histories.get(phone) || [];
    h.push(att);
    this.histories.set(phone, h);
    return att;
  }
  async getAttestations(phone: string) {
    const h = this.histories.get(phone) || [];
    const balance = this.balances.get(phone) || 0;
    return { balance, history: h };
  }
}

// Factory: later, replace with real SAS SDK impl while keeping interface stable.
export function createSasClient(useMock: boolean): SasClient {
  if (useMock) return new MockSasClient();
  // Placeholder for real SAS SDK wiring:
  throw new Error('Real SAS client not wired in this starter. Set USE_MOCK_SAS=true');
}
