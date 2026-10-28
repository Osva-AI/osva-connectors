/**
 * Stripe-shaped strings built from fragments for hermetic tests only.
 * These are not issued credentials and must not be used outside tests.
 */

function joinKeyParts(...parts: string[]): string {
  return parts.join("_");
}

export function syntheticStripeTestSecretKey(): string {
  return joinKeyParts(
    "sk",
    "test",
    "not",
    "a",
    "real",
    "key",
    "for",
    "unit",
    "tests",
  );
}

export function syntheticStripeLiveSecretKey(): string {
  return joinKeyParts(
    "sk",
    "live",
    "not",
    "a",
    "real",
    "key",
    "for",
    "unit",
    "tests",
  );
}

export function syntheticStripeLiveRestrictedKey(): string {
  return joinKeyParts(
    "rk",
    "live",
    "not",
    "a",
    "real",
    "key",
    "for",
    "unit",
    "tests",
  );
}

export function syntheticStripeTestRestrictedKey(): string {
  return joinKeyParts(
    "rk",
    "test",
    "not",
    "a",
    "real",
    "key",
    "for",
    "unit",
    "tests",
  );
}

export function syntheticInvalidApiKeyShape(): string {
  return joinKeyParts("not", "a", "stripe", "api", "key", "shape");
}
