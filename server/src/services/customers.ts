// Privy wallet creation is stubbed for this starter.
// In production: call Privy to create a wallet bound to phone login
// and surface attestations/NFTs that your program issues.
export const customers = {
  async ensureWalletForPhone(phone: string) {
    console.log(`[stub-privy] ensure wallet for ${phone}`);
    return { walletAddress: 'StubWallet111111111111111111111111111111111' };
  },
};
