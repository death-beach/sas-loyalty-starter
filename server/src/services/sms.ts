export interface SmsProvider {
  send(to: string, body: string): Promise<void>;
}

class StubSms implements SmsProvider {
  async send(to: string, body: string) {
    console.log(`[stub-sms] -> ${to}: ${body}`);
  }
}

let TwilioLib: any | null = null;
async function getTwilio() {
  if (!TwilioLib) {
    // dynamic import but inside an async function (legal)
    TwilioLib = (await import('twilio')).default;
  }
  return TwilioLib;
}

class TwilioSms implements SmsProvider {
  private client: any;
  private from: string;

  constructor(client: any, from: string) {
    this.client = client;
    this.from = from;
  }

  static async create() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (!sid || !token || !from) throw new Error('Twilio env vars missing');

    const twilio = await getTwilio();
    const client = twilio(sid, token);
    return new TwilioSms(client, from);
  }

  async send(to: string, body: string) {
    await this.client.messages.create({ to, from: this.from, body });
  }
}

export function createSmsProvider(provider: string): SmsProvider {
  // For simplicity in this starter, keep construction sync:
  // - if provider === 'twilio', we lazily connect on first send
  if (provider === 'twilio') {
    // Return a small proxy that initializes Twilio on first call
    let real: TwilioSms | null = null;
    return {
      async send(to: string, body: string) {
        if (!real) real = await TwilioSms.create();
        return real.send(to, body);
      },
    };
  }
  return new StubSms();
}