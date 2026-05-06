"use client";

import { useState } from "react";
import { Logo } from "@/app/_components/GlobalComponents/Layout/Logo/Logo";
import { LegacyLogo } from "@/app/_components/GlobalComponents/Layout/Logo/LegacyLogo";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import { useTranslations } from "next-intl";

interface DynamicLogoProps {
  className?: string;
  pathClassName?: string;
}

export const DynamicLogo = ({
  className = "h-8 w-8",
}: DynamicLogoProps) => {
  const { isRwMarkable, appSettings } = useAppMode();
  const [imageError, setImageError] = useState(false);
  const t = useTranslations();

  const customIcon =
    appSettings?.["180x180Icon"] ||
    appSettings?.["32x32Icon"] ||
    appSettings?.["16x16Icon"];

  if (customIcon && !imageError) {
    return (
      <img
        src={customIcon}
        alt={t("common.appLogo")}
        className={`jotty-logo ${className} object-contain`}
        onError={() => {
          setImageError(true);
        }}
      />
    );
  }

  return isRwMarkable ? (
    <LegacyLogo className={className} />
  ) : (
    <Logo className={className} />
  );
};
