"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentType, type SVGProps } from "react";
import {
  IoGift,
  IoGiftOutline,
  IoHome,
  IoHomeOutline,
  IoLockClosed,
  IoPersonCircle,
  IoPersonCircleOutline,
  IoWallet,
  IoWalletOutline,
} from "react-icons/io5";

import { CampaignAlerts } from "@/components/yapass/organisms";
import { cn } from "@/lib/cn";

type Tab = {
  href: string;
  label: string;
  ActiveIcon: ComponentType<SVGProps<SVGSVGElement>>;
  InactiveIcon: ComponentType<SVGProps<SVGSVGElement>>;
  /** When true, the tab renders disabled with a lock badge and is not navigable. */
  locked?: boolean;
};

const TABS: Tab[] = [
  { href: "/", label: "Inicio", ActiveIcon: IoHome, InactiveIcon: IoHomeOutline },
  {
    href: "/beneficios",
    label: "Beneficios",
    ActiveIcon: IoGift,
    InactiveIcon: IoGiftOutline,
    locked: true,
  },
  {
    href: "/billetera",
    label: "Billetera",
    ActiveIcon: IoWallet,
    InactiveIcon: IoWalletOutline,
  },
  {
    href: "/tu",
    label: "Tú",
    ActiveIcon: IoPersonCircle,
    InactiveIcon: IoPersonCircleOutline,
  },
];

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <main className="flex-1 pb-20">{children}</main>
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-divider bg-white px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.25rem)]"
      >
        <ul className="flex h-16 items-center justify-around">
          {TABS.map(({ href, label, ActiveIcon, InactiveIcon, locked }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const Icon = active ? ActiveIcon : InactiveIcon;

            const inner = (
              <>
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" />
                  {locked ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-1 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-ink/85 text-white shadow-sm"
                    >
                      <IoLockClosed className="h-[9px] w-[9px]" />
                    </span>
                  ) : null}
                </span>
                <span>{label}</span>
              </>
            );

            const baseClasses =
              "flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-semibold transition-colors";

            return (
              <li key={href} className="flex-1">
                {locked ? (
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-label={`${label} (bloqueado)`}
                    title={`${label} está bloqueado`}
                    onClick={(e) => e.preventDefault()}
                    className={cn(
                      baseClasses,
                      "w-full cursor-not-allowed text-text-muted/60",
                    )}
                  >
                    {inner}
                  </button>
                ) : (
                  <Link
                    href={href}
                    className={cn(baseClasses, active ? "text-primary" : "text-text-muted")}
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Global controller — listens to the SSE stream and shows the
          campaign alert modal over whichever tab the user is on. */}
      <Suspense fallback={null}>
        <CampaignAlerts />
      </Suspense>
    </div>
  );
}
