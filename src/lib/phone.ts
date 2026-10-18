import { parsePhoneNumberFromString } from 'libphonenumber-js';

const E164 = /^\+[1-9]\d{7,14}$/;

/** A real phone number, returned as E.164. National input is read as US. */
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, 'US');
  if (!parsed?.isValid()) return null;
  const e164 = parsed.format('E.164');
  return E164.test(e164) ? e164 : null;
}
