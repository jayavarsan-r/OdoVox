import { normalizePhone } from '../phone.js';
import { AppError } from '../errors.js';
import type { IOtpSender, OtpLogger, OtpSendResult } from './sender.js';

const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow/';

/**
 * MSG91 Flow / Transactional SMS sender. We generate and verify the OTP ourselves, so we
 * use the Flow API (not MSG91's SendOTP API) to deliver our own code.
 *
 * PREREQUISITE — DLT registration: MSG91 + Indian telecom DLT rules require the SMS
 * template to be pre-registered with the operator before any message is delivered. Register
 * a template with this exact body and plug its template_id into MSG91_TEMPLATE_ID:
 *
 *   "Your Odovox verification code is {{otp}}. Valid for 10 minutes. Do not share."
 *
 * DLT registration docs: https://docs.msg91.com/sms/dlt-registration
 * Flow API docs:          https://docs.msg91.com/reference/send-flow
 */
export class Msg91OtpSender implements IOtpSender {
  private readonly authKey: string;
  private readonly templateId: string;

  constructor(
    opts?: { authKey?: string; templateId?: string },
    private readonly logger?: OtpLogger,
  ) {
    const authKey = opts?.authKey ?? process.env.MSG91_AUTH_KEY;
    const templateId = opts?.templateId ?? process.env.MSG91_TEMPLATE_ID;
    if (!authKey || !templateId) {
      throw new AppError(
        'MSG91 is not configured (MSG91_AUTH_KEY / MSG91_TEMPLATE_ID missing)',
        500,
        'OTP_PROVIDER_MISCONFIGURED',
      );
    }
    this.authKey = authKey;
    this.templateId = templateId;
  }

  async send(phone: string, otp: string): Promise<OtpSendResult> {
    const mobiles = `91${normalizePhone(phone)}`;
    const body = {
      template_id: this.templateId,
      short_url: '0',
      recipients: [{ mobiles, otp }],
    };

    const res = await fetch(MSG91_FLOW_URL, {
      method: 'POST',
      headers: {
        authkey: this.authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      this.logger?.error(
        { status: res.status, payload },
        'MSG91 flow request failed',
      );
      throw new AppError(
        `MSG91 delivery failed (HTTP ${res.status})`,
        502,
        'OTP_DELIVERY_FAILED',
      );
    }

    const requestId =
      payload && typeof payload === 'object' && 'request_id' in payload
        ? String((payload as { request_id: unknown }).request_id)
        : 'unknown';

    this.logger?.info({ requestId, mobiles }, 'MSG91 OTP dispatched');

    return { providerId: requestId, sentAt: new Date() };
  }
}
