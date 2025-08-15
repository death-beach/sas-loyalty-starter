export class RedemptionCodes {
  private codes = new Map<string, { amount: number; phone?: string; consumed: boolean }>();

  create(amount: number, phone?: string) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.codes.set(code, { amount, phone, consumed: false });
    return code;
  }

  verify(code: string, phone?: string) {
    const rec = this.codes.get(code);
    if (!rec || rec.consumed) return false;
    if (rec.phone && phone && rec.phone !== phone) return false;
    return true;
  }

  // Returns coupon amount if valid, else null; consumes the code.
  verifyAndConsume(code: string, phone?: string): number | null {
    const rec = this.codes.get(code);
    if (!rec || rec.consumed) return null;
    if (rec.phone && phone && rec.phone !== phone) return null;
    rec.consumed = true;
    this.codes.set(code, rec);
    return rec.amount;
  }
}