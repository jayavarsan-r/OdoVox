import { MockOtpSender } from './mock-sender.js';
import { Msg91OtpSender } from './msg91-sender.js';
import type { IOtpSender, OtpLogger } from './sender.js';

export type { IOtpSender, OtpSendResult, OtpLogger } from './sender.js';
export { MockOtpSender } from './mock-sender.js';
export { Msg91OtpSender } from './msg91-sender.js';

/**
 * Returns the OTP sender selected by OTP_PROVIDER. Defaults to the mock sender so dev and
 * tests never hit a real SMS gateway.
 */
export function getOtpSender(logger?: OtpLogger): IOtpSender {
  const provider = process.env.OTP_PROVIDER;
  if (provider === 'msg91') return new Msg91OtpSender(undefined, logger);
  return new MockOtpSender(logger);
}
