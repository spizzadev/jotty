import { ProjectTimeEntry } from "@/app/_types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `0:${String(m).padStart(2, "0")}`;
}

export function exportEntriesToCsv(
  entries: ProjectTimeEntry[],
  taskTitle: string,
  hourlyRate?: number,
  currency = "EUR",
): void {
  const completedEntries = entries.filter((e) => e.durationMin !== undefined);

  const headers = ["Date", "Description", "Duration (h:mm)", ...(hourlyRate ? [`Amount (${currency})`] : [])];

  const rows = completedEntries.map((entry) => {
    const amount = hourlyRate ? ((entry.durationMin! / 60) * hourlyRate).toFixed(2) : null;
    return [
      formatDate(entry.start),
      `"${entry.description.replace(/"/g, '""')}"`,
      formatDuration(entry.durationMin!),
      ...(amount ? [amount] : []),
    ].join(",");
  });

  const totalMin = completedEntries.reduce((sum, e) => sum + (e.durationMin ?? 0), 0);
  const totalAmount = hourlyRate ? ((totalMin / 60) * hourlyRate).toFixed(2) : null;
  const totalsRow = [
    "TOTAL",
    "",
    formatDuration(totalMin),
    ...(totalAmount ? [totalAmount] : []),
  ].join(",");

  const csv = [headers.join(","), ...rows, "", totalsRow].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `time-tracking-${taskTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
