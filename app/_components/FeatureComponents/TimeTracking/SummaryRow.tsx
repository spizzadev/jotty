"use client";

interface SummaryRowProps {
  totalMin: number;
  totalAmount?: number;
  currency?: string;
}

function formatTotalDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export const SummaryRow = ({ totalMin, totalAmount, currency = "EUR" }: SummaryRowProps) => {
  if (totalMin === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground">Total</span>
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm font-semibold">
          {formatTotalDuration(totalMin)}
        </span>
        {totalAmount !== undefined && totalAmount > 0 && (
          <span className="font-mono text-sm font-semibold text-primary">
            {totalAmount.toFixed(2)} {currency}
          </span>
        )}
      </div>
    </div>
  );
};
