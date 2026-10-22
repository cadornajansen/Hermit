// Deliberately narrow: ambiguous labels, other people's details, financial and
// identification fields must never acquire reusable meaning through fuzzy matching.
export const REUSABLE_FIELDS = {
  owner_name: [
    "Owner / taxpayer name",
    "Owner name",
    "Taxpayer name",
    "Proprietor name",
  ],
  residence: ["Residence address", "Home address", "Residential address"],
  mobile: ["Mobile number", "Mobile phone", "Cellphone number"],
  email: ["Email address", "E-mail address", "Email"],
  business_name: [
    "Business / trade name",
    "Business name",
    "Trade name",
    "Registered business name",
  ],
  business_address: [
    "Business address",
    "Registered business address",
    "Office address",
  ],
  barangay: ["Barangay", "Brgy"],
  city: ["City / municipality", "City", "Municipality"],
  activity: [
    "Line of business / activity",
    "Line of business",
    "Business activity",
  ],
  psic: ["PSIC code", "PSIC"],
  structure: [
    "Type of organization",
    "Business structure",
    "Organization type",
  ],
  premises: ["Place of business is", "Business premises"],
  rdo_code: ["RDO code", "Revenue district office code"],
  start_date: ["Date business started / will start", "Business start date"],
  floor_area: ["Business area (sq m)", "Business floor area"],
} as const

export type ReusableKey = keyof typeof REUSABLE_FIELDS
export type ReusableAnswer = {
  value: string
  updatedAt: string
  sourceForm: string
}
export type FormMemory = {
  consentedAt: string | null
  answers: Partial<Record<ReusableKey, ReusableAnswer>>
}
export const emptyFormMemory = (): FormMemory => ({
  consentedAt: null,
  answers: {},
})

const normalize = (label: string) =>
  label
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
const aliases = new Map<string, ReusableKey>()
for (const [key, labels] of Object.entries(REUSABLE_FIELDS)) {
  for (const label of [key, ...labels])
    aliases.set(normalize(label), key as ReusableKey)
}

export const matchReusableField = (label: string) =>
  aliases.get(normalize(label))

export function eligibleAnswers(values: Record<string, unknown>) {
  const result: Partial<Record<ReusableKey, string>> = {}
  const conflicts = new Set<ReusableKey>()
  for (const [label, value] of Object.entries(values)) {
    const key = matchReusableField(label)
    if (
      !key ||
      typeof value !== "string" ||
      !value.trim() ||
      value.length > 500
    )
      continue
    if (result[key] && result[key] !== value.trim()) conflicts.add(key)
    result[key] = value.trim()
  }
  for (const key of conflicts) delete result[key]
  return result
}

export function rememberAnswers(
  memory: FormMemory,
  consent: unknown,
  values: Record<string, unknown>,
  sourceForm: string,
  now = new Date().toISOString()
): FormMemory {
  if (consent !== true) return memory
  const answers = { ...memory.answers }
  for (const [key, value] of Object.entries(eligibleAnswers(values))) {
    answers[key as ReusableKey] = {
      value,
      updatedAt: now,
      sourceForm: sourceForm.slice(0, 100),
    }
  }
  return { consentedAt: now, answers }
}

export function editRememberedAnswer(
  memory: FormMemory,
  key: ReusableKey,
  value: string,
  now = new Date().toISOString()
): FormMemory {
  if (!memory.consentedAt || !memory.answers[key])
    throw new Error("Save this field with consent first.")
  const answers = { ...memory.answers }
  if (!value.trim()) delete answers[key]
  else {
    const eligible = eligibleAnswers({ [key]: value })[key]
    if (!eligible) throw new Error("Use a value of at most 500 characters.")
    answers[key] = {
      value: eligible,
      updatedAt: now,
      sourceForm: "profile review",
    }
  }
  return { ...memory, answers }
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">
export const memoryKey = (ownerId: string) => `hermit:answers:v1:${ownerId}`
export const ownerStateKey = (ownerId: string) => `hermit:owner:v2:${ownerId}`

export function loadFormMemory(storage: Storage, ownerId: string): FormMemory {
  try {
    const record = JSON.parse(storage.getItem(memoryKey(ownerId)) ?? "null")
    if (
      record?.ownerId !== ownerId ||
      typeof record.consentedAt !== "string" ||
      !Number.isFinite(Date.parse(record.consentedAt))
    )
      return emptyFormMemory()
    const answers: FormMemory["answers"] = {}
    for (const [key, answer] of Object.entries(record.answers ?? {}) as [
      ReusableKey,
      ReusableAnswer,
    ][]) {
      // Stored keys must already be canonical. Recheck the policy on every read.
      if (
        !Object.hasOwn(REUSABLE_FIELDS, key) ||
        !answer ||
        typeof answer.updatedAt !== "string" ||
        typeof answer.sourceForm !== "string"
      )
        continue
      const value = eligibleAnswers({ [key]: answer.value })[key]
      if (value)
        answers[key] = {
          value,
          updatedAt: answer.updatedAt,
          sourceForm: answer.sourceForm.slice(0, 100),
        }
    }
    return { consentedAt: record.consentedAt, answers }
  } catch {
    return emptyFormMemory()
  }
}

export function persistFormMemory(
  storage: Storage,
  ownerId: string,
  memory: FormMemory
) {
  if (!ownerId) throw new Error("Wait for your account to load.")
  if (!memory.consentedAt) storage.removeItem(memoryKey(ownerId))
  else
    storage.setItem(memoryKey(ownerId), JSON.stringify({ ...memory, ownerId }))
}

export function resolveFormValue(
  account: string,
  saved: string,
  current?: string
) {
  return {
    value: current !== undefined ? current : account || saved,
    source:
      current !== undefined
        ? "current form"
        : account
          ? "account"
          : saved
            ? "saved answer"
            : "",
    conflict: !!account && !!saved && account !== saved,
  }
}
