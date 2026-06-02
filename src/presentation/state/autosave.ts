export interface AutosavePolicy { enabled: boolean; debounceMs: number; saveWhenValidOnly: boolean; }
export const defaultAutosavePolicy: AutosavePolicy = { enabled: true, debounceMs: 1200, saveWhenValidOnly: true };
export function shouldAutosave(policy: AutosavePolicy, dirty: boolean, valid: boolean): boolean { if (!policy.enabled || !dirty) return false; return policy.saveWhenValidOnly ? valid : true; }
