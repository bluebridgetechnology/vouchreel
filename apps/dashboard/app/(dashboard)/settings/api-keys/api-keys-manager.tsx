"use client";

import { useState, useEffect, useCallback } from "react";

interface SpaceOption {
  id: string;
  name: string;
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export function ApiKeysManager({ spaces }: { spaces: SpaceOption[] }) {
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(
    spaces[0]?.id || ""
  );
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New key modal state
  const [isCreating, setIsCreating] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async (spaceId: string) => {
    if (!spaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/api-keys`);
      if (!res.ok) throw new Error("Failed to load API keys");
      const data = await res.json();
      setKeys(data.apiKeys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSpaceId) {
      fetchKeys(selectedSpaceId);
    }
  }, [selectedSpaceId, fetchKeys]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim() || !selectedSpaceId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${selectedSpaceId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to create API key");
      }

      const data = await res.json();
      setCreatedRawKey(data.apiKey.rawKey);
      setKeyName("");
      fetchKeys(selectedSpaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating key");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? Any applications using it will be immediately disconnected.")) {
      return;
    }

    try {
      const res = await fetch(
        `/api/spaces/${selectedSpaceId}/api-keys/${keyId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to revoke key");
      fetchKeys(selectedSpaceId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error revoking key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (spaces.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-muted-foreground">
        You need to create a Space first before generating API keys.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Space Selector & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="spaceSelect" className="text-sm font-medium">
            Active Space:
          </label>
          <select
            id="spaceSelect"
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setIsCreating(true);
            setCreatedRawKey(null);
          }}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          + Generate New API Key
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* API Key Created Dialog / Banner */}
      {createdRawKey && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">
              API Key Generated Successfully
            </h3>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Show Once
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Make sure to copy your API key now as you won&apos;t be able to see it again!
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={createdRawKey}
              className="flex-1 font-mono text-xs bg-background border rounded px-3 py-2 select-all"
            />
            <button
              onClick={() => copyToClipboard(createdRawKey)}
              className="px-3 py-2 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {isCreating && !createdRawKey && (
        <div className="rounded-lg border bg-card p-4 sm:p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-base">Generate New API Key</h3>
          <form onSubmit={handleCreateKey} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Key Label / Description
              </label>
              <input
                type="text"
                placeholder="e.g. Zapier Automation, Production Server"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 rounded text-sm font-medium border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 rounded text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? "Generating..." : "Generate"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Keys List */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Key Prefix</th>
              <th className="px-4 py-3">Last Used</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {keys.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {loading ? "Loading API keys..." : "No API keys created for this space yet."}
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {k.keyPrefix}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {k.lastUsedAt
                      ? new Date(k.lastUsedAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteKey(k.id)}
                      className="text-xs font-medium text-destructive hover:underline"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
