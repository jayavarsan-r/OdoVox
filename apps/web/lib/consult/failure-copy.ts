/**
 * What the doctor is told when processing fails.
 *
 * The FAILED state carries a raw string — `err.message` from fetch, or an API error — and
 * that string used to render straight onto the screen. A dentist mid-clinic was reading
 * "Failed to fetch". Frame 26 says "The network dropped." instead, and the #43 ruling is
 * explicit that internal detail (fetch semantics, provider names, pipeline stages) does
 * not reach the dentist-facing UI.
 *
 * So the raw error stays in the state for logs and support; this is what gets displayed.
 * The fallback is deliberately vague rather than a guess — telling a doctor the wrong
 * cause is worse than telling them none, because both end at the same action: try again.
 */
export function failureMessage(raw: string | undefined): string {
  const s = (raw ?? '').toLowerCase();

  if (/failed to fetch|networkerror|network request failed|econnrefused|err_network|offline/.test(s)) {
    return 'The network dropped.';
  }
  if (/timeout|timed out|etimedout|aborted/.test(s)) {
    return 'That took too long to reach us.';
  }
  if (/\b(401|403)\b|unauthor|forbidden|session/.test(s)) {
    return 'Your session expired.';
  }
  if (/\b5\d\d\b|internal server|bad gateway|unavailable/.test(s)) {
    return "Odovox couldn't take the recording just now.";
  }
  return "That didn't go through.";
}
