/** Copy text to the clipboard, with a legacy execCommand fallback. Returns success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const okFlag = document.execCommand('copy');
    document.body.removeChild(el);
    return okFlag;
  } catch {
    return false;
  }
}
