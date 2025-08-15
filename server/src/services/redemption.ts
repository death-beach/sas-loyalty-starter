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
  verifyAndConsume(code: string, phone?: string) {
    const ok = this.verify(code, phone);
    if (!ok) return false;
    const rec = this.codes.get(code)!;
    rec.consumed = true;
    this.codes.set(code, rec);
    return true;
  }
}
