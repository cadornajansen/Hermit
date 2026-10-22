"use client"

import { Combobox } from "@base-ui/react/combobox"
import { Check, ChevronDown, X } from "lucide-react"
import { useId } from "react"

import {
  citiesForRegion,
  matchesLocation,
  regions,
  resolveLocation,
  selectCity,
  selectRegion,
  type LocationValue,
} from "@/lib/locations"

type Option = { code: string; name: string; label: string }

function LocationCombobox({
  label,
  options,
  code,
  savedValue,
  disabled,
  description,
  issueId,
  onSelect,
}: {
  label: string
  options: Option[]
  code?: string
  savedValue: string
  disabled?: boolean
  description: string
  issueId?: string
  onSelect: (code: string | null) => void
}) {
  const id = useId()
  const selected =
    options.find((option) => option.code === code) ??
    (savedValue ? { code: "", name: savedValue, label: savedValue } : null)
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={id}>{label}</label>
      <Combobox.Root
        items={options}
        value={selected}
        disabled={disabled}
        filter={matchesLocation}
        itemToStringLabel={(option) => option.label}
        isItemEqualToValue={(a, b) => a.code === b.code}
        onValueChange={(option, details) => {
          // Search text is a draft; only a choice or the clear button edits the profile.
          if (option || details.reason === "clear-press")
            onSelect(option?.code ?? null)
        }}
      >
        <div className="flex min-h-11 items-center rounded-xl border bg-background focus-within:ring-2 focus-within:ring-ring">
          <Combobox.Input
            id={id}
            aria-describedby={[`${id}-help`, issueId].filter(Boolean).join(" ")}
            aria-invalid={Boolean(savedValue && !code)}
            placeholder={
              disabled
                ? "Choose a region first"
                : `Search ${label.toLowerCase()}…`
            }
            className="h-11 min-w-0 flex-1 rounded-xl bg-transparent px-3 text-base outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          {selected && !disabled && (
            <Combobox.Clear
              tabIndex={0}
              aria-label={`Clear ${label.toLowerCase()}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden />
            </Combobox.Clear>
          )}
          <Combobox.Trigger
            aria-label={`Show ${label.toLowerCase()} choices`}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <ChevronDown className="size-4" aria-hidden />
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} className="z-50">
            <Combobox.Popup className="w-(--anchor-width) max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
              <Combobox.Empty className="p-3 text-sm text-muted-foreground">
                No matching locations. Try another search.
              </Combobox.Empty>
              <Combobox.List className="max-h-64 overflow-y-auto p-1">
                {(option: Option) => (
                  <Combobox.Item
                    key={option.code}
                    value={option}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <span className="flex-1">{option.label}</span>
                    <Combobox.ItemIndicator>
                      <Check className="size-4" aria-hidden />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

export function LocationFields({
  value,
  onChange,
}: {
  value: LocationValue
  onChange: (patch: LocationValue) => void
}) {
  const { region, city, issue } = resolveLocation(value)
  const issueId = useId()
  return (
    <div className="flex flex-col gap-3">
      <LocationCombobox
        label="Region"
        options={regions.map((r) => ({ ...r, label: r.name }))}
        code={region?.code}
        savedValue={value.region || region?.name || ""}
        issueId={issue ? issueId : undefined}
        description="Type to filter, use ↑ / ↓ to browse, Enter to select, or Escape to close."
        onSelect={(code) => onChange(selectRegion(value, code))}
      />
      <LocationCombobox
        key={region?.code ?? "no-region"}
        label="City / municipality"
        options={citiesForRegion(region?.code ?? "").map((c) => ({
          ...c,
          label: c.province ? `${c.name} · ${c.province}` : c.name,
        }))}
        code={city?.code}
        savedValue={value.city}
        issueId={issue ? issueId : undefined}
        disabled={!region}
        description={
          region
            ? "Choose a city or municipality in this region. Province names distinguish places with the same name."
            : "Choose a region to see its cities and municipalities."
        }
        onSelect={(code) => onChange(selectCity(value, code))}
      />
      {issue && (
        <p id={issueId} role="status" className="rounded-xl border p-3 text-sm">
          {issue}
        </p>
      )}
    </div>
  )
}
