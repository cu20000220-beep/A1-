/** Server-owned policy only. Never infer beta access from headers, cookies or claims. */
export function isFreeBetaMode(env) {
  return env?.A1_FREE_BETA_MODE === 'true';
}

export function publicBetaPolicy(env) {
  // Public catalog previews and on-device fitting are available under either
  // membership policy. Only freeBetaMode governs the existing server services.
  return { localFashionEnabled: true, freeBetaMode: isFreeBetaMode(env),
    billingEnabled: false, accountRequiredForSaving: true };
}
