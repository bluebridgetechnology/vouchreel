"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** A Select for a plain GET filter form: Radix renders a hidden field named `name`, so the form still submits. */
export function FormSelect({ name, label, options, value }: { name: string; label: string; options: { value: string; label: string }[]; value: string }) {
  return (
    <Select name={name} defaultValue={value}>
      <SelectTrigger aria-label={label} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
