"use client"

import { CalendarDays, type LucideIcon } from "lucide-react"
import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function TextField({
  label,
  hint,
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string
  hint?: string
  icon?: LucideIcon
}) {
  const id = useId()
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id} className="inline-flex items-center gap-2">
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
        {label}
      </FieldLabel>
      <Input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn("h-12 px-4 text-base", className)}
        {...props}
      />
      {hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
    </Field>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  unknown = true,
  icon: Icon,
}: {
  label: string
  value: string
  options: Record<string, string>
  onChange: (value: string) => void
  unknown?: boolean
  icon?: LucideIcon
}) {
  const id = useId()
  const all = unknown ? { ...options, unknown: "I’m not sure yet" } : options
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id} className="inline-flex items-center gap-2">
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
        {label}
      </FieldLabel>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next)
        }}
        items={all}
      >
        <SelectTrigger id={id} className="h-12 w-full min-w-0 px-4 text-base">
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="start"
          side="bottom"
          sideOffset={8}
          className="max-h-[min(20rem,var(--available-height))] w-(--anchor-width) max-w-[calc(100vw-2rem)] min-w-0 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-x-hidden overflow-y-auto rounded-2xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
        >
          <SelectGroup>
            {Object.entries(all).map(([key, text]) => (
              <SelectItem
                key={key}
                value={key}
                className="min-h-11 text-base [&>span:first-child]:min-w-0 [&>span:first-child]:shrink [&>span:first-child]:whitespace-normal"
              >
                {text}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

export function ChoiceField({
  label,
  hint,
  value,
  options,
  onChange,
  unknown = true,
  unknownLabel = "I’m not sure yet",
  layout = "cards",
  icon: Icon,
}: {
  label: string
  hint?: string
  value: string
  options: Record<string, string>
  onChange: (value: string) => void
  unknown?: boolean
  unknownLabel?: string
  layout?: "cards" | "inline"
  icon?: LucideIcon
}) {
  const id = useId()
  const all = unknown ? { ...options, unknown: unknownLabel } : options
  return (
    <FieldSet className="gap-2 has-[>[data-slot=radio-group]]:gap-2">
      <FieldLegend
        id={`${id}-label`}
        variant="label"
        className="mb-2 inline-flex items-center gap-2"
      >
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
        {label}
      </FieldLegend>
      {hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
      <RadioGroup
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        value={value}
        onValueChange={onChange}
        className={cn(
          "gap-2",
          layout === "inline" ? "grid-cols-3" : "sm:grid-cols-2"
        )}
      >
        {Object.entries(all).map(([key, text]) => (
          <FieldLabel
            key={key}
            htmlFor={`${id}-${key}`}
            className={cn(
              "w-full cursor-pointer items-center gap-2 rounded-2xl border text-sm font-normal transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
              layout === "inline"
                ? "min-h-11 justify-center px-2 py-2"
                : "min-h-12 p-3",
              value === key
                ? "border-primary bg-accent"
                : "border-border hover:bg-muted"
            )}
          >
            <RadioGroupItem id={`${id}-${key}`} value={key} />
            {text}
          </FieldLabel>
        ))}
      </RadioGroup>
    </FieldSet>
  )
}

export function BirthDateField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const date = value ? new Date(`${value}T00:00:00`) : undefined
  const selected = date && !Number.isNaN(date.getTime()) ? date : undefined
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id} className="inline-flex items-center gap-2">
        <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
        Date of birth (optional)
      </FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          render={
            <Button
              variant="outline"
              className="h-12 w-full justify-between px-4 text-base"
            />
          }
        >
          {selected
            ? selected.toLocaleDateString("en-PH", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "Select your date of birth"}
          <CalendarDays data-icon="inline-end" />
        </PopoverTrigger>
        <PopoverContent
          className="w-auto max-w-[calc(100vw-2rem)] p-2"
          align="start"
        >
          <PopoverTitle className="sr-only">
            Choose your date of birth
          </PopoverTitle>
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={selected}
            defaultMonth={selected ?? new Date(2000, 0)}
            startMonth={new Date(1900, 0)}
            endMonth={new Date()}
            disabled={{ after: new Date() }}
            onSelect={(day) => {
              if (!day) return
              onChange(
                `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
              )
              setOpen(false)
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
          >
            Clear date
          </Button>
        </PopoverContent>
      </Popover>
    </Field>
  )
}
