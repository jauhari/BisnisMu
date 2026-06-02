export interface FieldIssue { path: string; message: string; code?: string; }
export interface FormValidationState { valid: boolean; issues: FieldIssue[]; }
export interface FormDraftState<T> { initial: T; current: T; savedAt?: Date; dirty: boolean; undoStack: T[]; validation: FormValidationState; }

export function createFormDraft<T>(initial: T): FormDraftState<T> { return { initial, current: initial, dirty: false, undoStack: [], validation: { valid: true, issues: [] } }; }
export function updateFormDraft<T>(state: FormDraftState<T>, next: T): FormDraftState<T> { return { ...state, current: next, dirty: JSON.stringify(next) !== JSON.stringify(state.initial), undoStack: [...state.undoStack, state.current].slice(-20) }; }
export function markSaved<T>(state: FormDraftState<T>, savedAt = new Date()): FormDraftState<T> { return { ...state, initial: state.current, dirty: false, savedAt, undoStack: [] }; }
export function undoFormDraft<T>(state: FormDraftState<T>): FormDraftState<T> { const previous = state.undoStack.at(-1); if (previous === undefined) return state; return { ...state, current: previous, dirty: JSON.stringify(previous) !== JSON.stringify(state.initial), undoStack: state.undoStack.slice(0, -1) }; }
export function applyValidation<T>(state: FormDraftState<T>, validation: FormValidationState): FormDraftState<T> { return { ...state, validation }; }
