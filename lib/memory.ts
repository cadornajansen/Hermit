// Short facts only; anything that looks like an ID, account or amount is refused.
export function memorable(fact: unknown) {
  if (typeof fact !== "string") return null
  const f = fact.replace(/\s+/g, " ").trim()
  if (f.length < 4 || f.length > 160) return null
  if ((f.match(/\d/g) ?? []).length >= 6 || /password|otp|\bpin\b|card|account no|\btin\b|₱|php\s?\d/i.test(f)) return null
  return f
}
