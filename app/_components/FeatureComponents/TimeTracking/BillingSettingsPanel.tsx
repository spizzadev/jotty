"use client";

import { useState, useEffect } from "react";
import { BillingSettings } from "@/app/_server/actions/time-entries";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";

const CURRENCIES = ["EUR", "CHF", "USD", "GBP"];

interface BillingSettingsPanelProps {
  initialSettings: BillingSettings | undefined;
  onSave: (settings: BillingSettings) => Promise<void>;
}

export const BillingSettingsPanel = ({
  initialSettings,
  onSave,
}: BillingSettingsPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(
    initialSettings?.hourlyRate?.toString() ?? "",
  );
  const [currency, setCurrency] = useState(initialSettings?.currency ?? "EUR");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setHourlyRate(initialSettings.hourlyRate?.toString() ?? "");
      setCurrency(initialSettings.currency ?? "EUR");
    }
  }, [initialSettings]);

  const handleSave = async () => {
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate < 0) return;
    setSaving(true);
    await onSave({ hourlyRate: rate, currency });
    setSaving(false);
    setExpanded(false);
  };

  const hasSettings =
    initialSettings?.hourlyRate && initialSettings.hourlyRate > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg"
      >
        <span className="text-muted-foreground">Billing Settings</span>
        <span className="text-xs text-muted-foreground">
          {hasSettings
            ? `${initialSettings!.hourlyRate} ${initialSettings!.currency}/h`
            : "Not configured"}{" "}
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="flex items-end gap-3 px-4 pb-4 border-t border-border pt-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-muted-foreground">Hourly Rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="e.g. 85"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !hourlyRate}
            size="sm"
            variant="default"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
};
