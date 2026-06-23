import { nanoid } from 'nanoid';
import { normalizePhone } from '../phone.js';
import type { IOtpSender, OtpLogger, OtpSendResult } from './sender.js';

const BRIGHT = '\x1b[1m\x1b[38;5;156m'; // bold lime-ish
const RESET = '\x1b[0m';

/**
 * Dev OTP "sender": never sends anything, just prints the code so testers know what to
 * type. The caller forces the OTP to `123456` in dev, so that's always what appears.
 */
export class MockOtpSender implements IOtpSender {
  constructor(private readonly logger?: OtpLogger) {}

  async send(phone: string, otp: string): Promise<OtpSendResult> {
    const line = `[MOCK OTP] +91${normalizePhone(phone)} → ${otp}`;
    if (this.logger) {
      this.logger.info({ otpDelivery: 'mock', phone: `+91${normalizePhone(phone)}` }, line);
    } else {
      // eslint-disable-next-line no-console
      console.log(`${BRIGHT}${line}${RESET}`);
    }
    return { providerId: `mock-${nanoid()}`, sentAt: new Date() };
  }
}
