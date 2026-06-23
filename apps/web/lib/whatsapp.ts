/** Open WhatsApp (app or web) with a pre-filled message via the wa.me deep link. */
export function shareViaWhatsApp(text: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
