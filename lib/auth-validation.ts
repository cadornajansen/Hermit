export type Credentials = { email: string; password: string }
export type SignUpFields = Credentials & { fullName: string }
export type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

export function validateSignIn(formData: FormData): Validation<Credentials> {
  const email = field(formData, "email").trim()
  const password = field(formData, "password")
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "Enter a valid email address." }
  }
  if (!password) return { ok: false, error: "Enter your password." }
  return { ok: true, value: { email, password } }
}

export function validateSignUp(formData: FormData): Validation<SignUpFields> {
  const fullName = field(formData, "fullName").trim()
  if (!fullName || fullName.length > 100) {
    return { ok: false, error: "Enter your full name (up to 100 characters)." }
  }
  const credentials = validateSignIn(formData)
  if (!credentials.ok) return credentials
  if (credentials.value.password.length < 8) {
    return { ok: false, error: "Use a password with at least 8 characters." }
  }
  if (credentials.value.password !== field(formData, "confirmPassword")) {
    return { ok: false, error: "Your passwords do not match." }
  }
  return { ok: true, value: { ...credentials.value, fullName } }
}
