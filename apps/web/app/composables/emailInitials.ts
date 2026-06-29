export function emailInitials(email: string): string {
  const atIndex = email.indexOf('@')
  const localPart = atIndex === -1 ? email : email.slice(0, atIndex)
  const letters = localPart.replace(/[^a-zA-Z]/g, '').slice(0, 2)
  return (letters || email.slice(0, 2)).toUpperCase()
}
