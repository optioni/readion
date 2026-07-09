// Shared errored-field styling for the auth pages' credential inputs (login, reset-password).
// A failed login (401) or a reset confirm-password mismatch both need the same Readion
// danger-token border swapped in for the neutral default — this centralises that single class
// swap so both pages (which don't share a Field primitive) stay in sync.
export function credentialFieldBorderClass(hasError: boolean): string {
  return hasError ? 'border-readion-status-poor' : 'border-slate-700'
}
