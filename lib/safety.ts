/**
 * Emergency services number shown on the Safety screen. Fill in the correct number for
 * South Sudan once confirmed with local authorities; the button stays hidden while empty.
 */
export const EMERGENCY_NUMBER = "";

export function liveTripUrl(token: string) {
  return `${window.location.origin}/track/${token}`;
}

/** wa.me needs digits only, with country code. Numbers starting with 0 are treated as South Sudan (+211). */
export function whatsappNumber(phone: string) {
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `211${digits.slice(1)}`;
  return digits;
}

export function whatsappLink(text: string, phone?: string | null) {
  const to = phone ? whatsappNumber(phone) : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
