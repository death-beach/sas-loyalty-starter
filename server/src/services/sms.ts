export interface SmsProvider {
  send(to: string, body: string): Promise<void>;
}

class StubSms implements SmsProvider {
  async send(to: string, body: string) {
    console.log(`[stub-sms] -> ${to}: ${body}`);
  }
}

class TwilioSms implements SmsProvider {
  private client: any;
  private from: string;
  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (!sid || !token || !from) throw new Error('Twilio env vars missing');
    // dynamic import to keep optional
    const twilio = (await import('twilio')).default;
    this.client = twilio(sid, token);
    this.from = from;
  }
  async send(to: string, body: string) {
    await this.client.messages.create({ to, from: this.from, body });
  }
}

export function createSmsProvider(provider: string): SmsProvider {
  if (provider === 'twilio') return new TwilioSms();
  return new StubSms();
}
