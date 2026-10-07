"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Entity-type menu for the audit log's GET filter form. Radix renders a hidden native field named `name`, so the form still submits. */
export function AuditTypeSelect({ types, value }: { types: string[]; value?: string }) {
  return (
    <Select name="type" defaultValue={value || "all"}>
      <SelectTrigger aria-label="Type" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All types</SelectItem>
        {types.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
