"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/lib/notify";

/**
 * The widget's name in the editor's header: click it to rename. Enter or leaving the field saves, Escape
 * cancels, and a refused name (empty, too long) puts the old one back with the reason.
 */
export function WidgetName({ name, onRename }: { name: string; onRename: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!editing) setText(name);
  }, [name, editing]);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  async function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      setEditing(false);
      return;
    }
    const next = text.trim();
    setEditing(false);
    if (next === name) return;
    try {
      await onRename(next);
    } catch (err) {
      setText(name);
      notify.fromError(err, "Could not rename the widget");
    }
  }

  if (editing) {
    return (
      <input
        ref={input}
        value={text}
        maxLength={80}
        aria-label="Widget name"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") input.current?.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            input.current?.blur();
          }
        }}
        className="h-8 w-48 rounded-control border bg-surface px-2 text-base font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-64"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename"
      className={cn("group inline-flex max-w-[16rem] items-center gap-1.5 rounded-control px-1 py-0.5 text-base font-medium text-text hover:bg-surface-sunken")}
    >
      <span className="truncate">{name}</span>
      <Icon name="pen" size="sm" className="shrink-0 text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  );
}
