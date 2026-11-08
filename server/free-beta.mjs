/** Server-owned policy only. Never infer beta access from headers, cookies or claims. */
export function isFreeBetaMode(env) {
  return env?.A1_FREE_BETA_MODE === 'true';
}

export function publicBetaPolicy(env) {
  return { freeBetaMode: isFreeBetaMode(env), billingEnabled: false,
    accountRequiredForSaving: true };
}
