"use client";

import { Item } from "@/app/_types";
import { useTranslations } from "next-intl";

interface KanbanCardDetailPropertiesProps {
  item: Item;
  formatDateTimeString: (v: string) => string;
}

export const KanbanCardDetailProperties = ({
  item,
  formatDateTimeString,
}: KanbanCardDetailPropertiesProps) => {
  const t = useTranslations();

  const metadata = [];
  if (item.createdBy) {
    metadata.push(
      t("common.createdByOn", {
        user: item.createdBy,
        date: formatDateTimeString(item.createdAt!),
      }),
    );
  }
  if (item.lastModifiedBy) {
    metadata.push(
      t("common.lastModifiedByOn", {
        user: item.lastModifiedBy,
        date: formatDateTimeString(item.lastModifiedAt!),
      }),
    );
  }
  if (item.history?.length) {
    metadata.push(t("common.statusChanges", { count: item.history.length }));
  }

  return (
    <div className="space-y-5">
      {metadata.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {t("auditLogs.metadata")}
          </h5>
          <div className="space-y-1.5">
            {metadata.map((text, i) => (
              <p
                key={i}
                className="text-xs text-muted-foreground flex items-start gap-2"
              >
                <span className="text-muted-foreground/40">&bull;</span>
                <span>{text}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
