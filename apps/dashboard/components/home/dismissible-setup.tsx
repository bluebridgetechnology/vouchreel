"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

const KEY = "vouchreel:setup-hidden";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Lets an owner who already has videos on Home tuck the setup card away. The hero version is never wrapped. */
export function DismissibleSetup({ children }: { children: ReactNode }) {
  const storedHidden = useSyncExternalStore(
    () => () => {},
    read,
    () => false
  );
  const [hidden, setHidden] = useState(false);
  if (hidden || storedHidden) return null;
  return (
    <div className="space-y-1">
      {children}
      <div className="flex justify-end">
        <Button
          variant="link-muted"
          size="bare"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {}
            setHidden(true);
          }}
        >
          Hide for now
        </Button>
      </div>
    </div>
  );
}
