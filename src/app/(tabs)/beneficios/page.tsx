"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Beneficios is intentionally locked. The YAPASS 1 / YAPASS 2 frames that
 * used to live here are now rendered in-place on the Home screen when the
 * user taps "Ver Misiones". If anyone hard-navigates to `/beneficios`, we
 * just bounce them back home so they never see a half-broken state.
 */
export default function BeneficiosLocked() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?misiones=1");
  }, [router]);

  return null;
}
