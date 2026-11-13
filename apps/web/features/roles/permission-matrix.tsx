"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { groupPermissions, type PermissionGroup } from "@/lib/permissions";

function GroupBox({
  group,
  selected,
  readOnly,
  onToggle,
  onToggleGroup,
}: {
  group: PermissionGroup;
  selected: Set<string>;
  readOnly: boolean;
  onToggle: (key: string) => void;
  onToggleGroup: (keys: string[], on: boolean) => void;
}) {
  const keys = group.permissions.map((p) => p.key);
  const count = keys.filter((k) => selected.has(k)).length;
  const all = count === keys.length;
  const header = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (header.current) header.current.indeterminate = count > 0 && !all;
  }, [count, all]);

  return (
    <fieldset className="rounded-lg border border-slate-200">
      <legend className="sr-only">{group.label} permissions</legend>
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            ref={header}
            type="checkbox"
            checked={all}
            disabled={readOnly}
            onChange={(e) => onToggleGroup(keys, e.target.checked)}
            aria-label={`Select all ${group.label} permissions`}
            className="size-4 accent-primary"
          />
          {group.label}
        </label>
        <span className="text-xs text-slate-500">
          {count}/{keys.length}
        </span>
      </div>
      <ul className="grid gap-x-4 gap-y-1 p-3 sm:grid-cols-2">
        {group.permissions.map((p) => (
          <li key={p.key}>
            <label className={cn("flex items-center gap-2 text-sm", readOnly ? "text-slate-500" : "text-slate-700")}>
              <input
                type="checkbox"
                checked={selected.has(p.key)}
                disabled={readOnly}
                onChange={() => onToggle(p.key)}
                className="size-4 accent-primary"
              />
              <span>{p.label}</span>
              <code className="ml-auto hidden text-[11px] text-slate-400 lg:inline">{p.key}</code>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** Grouped checkbox grid for choosing a role's permissions. */
export function PermissionMatrix({
  permissions,
  value,
  onChange,
  readOnly = false,
}: {
  permissions: Array<{ key: string; module: string }>;
  value: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
}) {
  const selected = new Set(value);
  const groups = groupPermissions(permissions);

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <GroupBox
          key={g.module}
          group={g}
          selected={selected}
          readOnly={readOnly}
          onToggle={(key) => onChange(selected.has(key) ? value.filter((k) => k !== key) : [...value, key])}
          onToggleGroup={(keys, on) => onChange(on ? [...new Set([...value, ...keys])] : value.filter((k) => !keys.includes(k)))}
        />
      ))}
    </div>
  );
}
