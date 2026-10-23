export function storageKeyForAccount(userId: string | null): string {
  return userId === null ? "hermit:v1" : `hermit:v1:account:${userId}`
}
