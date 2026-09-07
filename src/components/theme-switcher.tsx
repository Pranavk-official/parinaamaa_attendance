"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const THEMES = [
  { value: "system", icon: Monitor, label: "System" },
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0];
  const Icon = current.icon;

  return (
    <Select
      value={theme ?? "system"}
      onValueChange={(v) => {
        if (v) setTheme(v);
      }}
    >
      <SelectTrigger aria-label="Theme" className="w-10 px-0 justify-center">
        <Icon className="size-4" />
      </SelectTrigger>
      <SelectContent>
        {THEMES.map((t) => {
          const ItemIcon = t.icon;
          return (
            <SelectItem key={t.value} value={t.value}>
              <span className="flex items-center gap-2">
                <ItemIcon className="size-4" />
                {t.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}