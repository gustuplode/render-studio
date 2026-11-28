// Hook variants A-D selector. REWRITTEN by the driver script before each gates/render run
// (a plain file, not an env var, so both tsx gates and the webpack bundle read the same value).
export type Variant = 'A' | 'B' | 'C' | 'D';
export const VARIANT: Variant = 'D';
