import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockOtpSender } from '../src/lib/otp/mock-sender.js';
import { Msg91OtpSender } from '../src/lib/otp/msg91-sender.js';
import { getOtpSender } from '../src/lib/otp/index.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MockOtpSender', () => {
  it('always succeeds and returns a mock providerId', async () => {
    const sender = new MockOtpSender();
    const result = await sender.send('9876543210', '123456');
    expect(result.providerId.startsWith('mock-')).toBe(true);
    expect(result.sentAt).toBeInstanceOf(Date);
  });
});

describe('Msg91OtpSender', () => {
  it('posts the correct Flow payload and returns the request_id', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ request_id: 'req_123', type: 'success' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const sender = new Msg91OtpSender({ authKey: 'AUTHKEY', templateId: 'TPL1' });
    const result = await sender.send('+91 98765-43210', '123456');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://control.msg91.com/api/v5/flow/');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers.authkey).toBe('AUTHKEY');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      template_id: 'TPL1',
      short_url: '0',
      recipients: [{ mobiles: '919876543210', otp: '123456' }],
    });
    expect(result.providerId).toBe('req_123');
  });

  it('throws on a 4xx/5xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'bad' }), { status: 400 }),
    );
    const sender = new Msg91OtpSender({ authKey: 'k', templateId: 't' });
    await expect(sender.send('9876543210', '123456')).rejects.toThrow(/MSG91 delivery failed/);
  });

  it('throws when not configured', () => {
    expect(() => new Msg91OtpSender({ authKey: '', templateId: '' })).toThrow(
      /not configured/,
    );
  });
});

describe('getOtpSender factory', () => {
  const prev = { ...process.env };
  afterEach(() => {
    process.env.OTP_PROVIDER = prev.OTP_PROVIDER;
    process.env.MSG91_AUTH_KEY = prev.MSG91_AUTH_KEY;
    process.env.MSG91_TEMPLATE_ID = prev.MSG91_TEMPLATE_ID;
  });

  it('returns the mock sender by default', () => {
    process.env.OTP_PROVIDER = 'mock';
    expect(getOtpSender()).toBeInstanceOf(MockOtpSender);
  });

  it('returns the MSG91 sender when configured', () => {
    process.env.OTP_PROVIDER = 'msg91';
    process.env.MSG91_AUTH_KEY = 'k';
    process.env.MSG91_TEMPLATE_ID = 't';
    expect(getOtpSender()).toBeInstanceOf(Msg91OtpSender);
  });
});
