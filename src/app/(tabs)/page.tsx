"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  IoArrowBack,
  IoArrowDownCircleOutline,
  IoBusinessOutline,
  IoCashOutline,
  IoPeopleOutline,
  IoPhonePortraitOutline,
  IoReaderOutline,
  IoStorefrontOutline,
  IoSwapHorizontalOutline,
  IoTrainOutline,
  IoWalletOutline,
} from "react-icons/io5";

import {
  ActionGrid,
  AdBanner,
  BalanceCard,
  Button,
  Card,
  ChallengeCard,
  DesafioModal,
  IconButton,
  LevelsCarousel,
  MapSection,
  Mascot,
  MissionRow,
  MissionsCard,
  PopupModal,
  RaspaYGanaPanel,
  ScanButton,
  ScreenHeader,
  WelcomeAdPopup,
} from "@/components/yapass";
import type {
  ActionTileProps,
  DesafioModalProps,
  Level,
  MapLocal,
} from "@/components/yapass";
import { useClaimedCampaigns } from "@/hooks/use-claimed-campaigns";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useOnceFlag } from "@/hooks/use-once-flag";
import { cn } from "@/lib/cn";

/**
 * Locales reales del barrio (coordenadas exactas suministradas por el equipo).
 * El centro de fallback es el promedio de las tres tiendas, así el mapa se
 * abre encuadrando todas aunque el GPS aún no haya respondido.
 */
const LOCALES: MapLocal[] = [
  {
    id: "1",
    title: "Víveres Merceditas",
    desc: "Abarrotes y víveres del barrio",
    lat: -0.198474,
    lng: -78.436024,
  },
  {
    id: "2",
    title: "Frutería Danny",
    desc: "Frutas y verduras frescas",
    lat: -0.198698,
    lng: -78.435455,
  },
  {
    id: "3",
    title: "Quantum",
    desc: "Tienda de tecnología y accesorios",
    lat: -0.198349,
    lng: -78.435856,
  },
];

const FALLBACK_CENTER = {
  lat: (LOCALES[0].lat + LOCALES[1].lat + LOCALES[2].lat) / 3,
  lng: (LOCALES[0].lng + LOCALES[1].lng + LOCALES[2].lng) / 3,
};

/**
 * "Desafío Uno / Dos / Tres" detail content — mirrors the Figma frames
 * (211:220, 211:222, 211:225). Keys match the discriminator stored in
 * `activeDesafio` state below.
 */
type DesafioId = "uno" | "dos" | "tres";

const DESAFIOS: Record<
  DesafioId,
  Omit<DesafioModalProps, "visible" | "onClose">
> = {
  uno: {
    heroSrc: "/assets/missions/desafio-uno.png",
    category: "Desafío de Compras",
    title: "3 Locales Diferentes",
    description:
      "Realiza compras en tres marcas o locales participantes distintos.",
    validity: "Del 1 al 31 de mayo de 2026.",
    steps: [
      "Compra en un comercio participante.",
      "Repite en dos comercios participantes más, que sean diferentes.",
      "Tu progreso se actualizará.",
    ],
  },
  dos: {
    heroSrc: "/assets/missions/desafio-dos.png",
    category: "Apoyo Local",
    title: "$10 en tu Barrio",
    description:
      "Acumula un total de $10 en compras en comercios de tu zona.",
    validity: "Del 1 al 31 de mayo de 2026.",
    steps: [
      "Compra en cualquier tienda de barrio registrada cerca de ti.",
      "Repite tus compras hasta alcanzar un total de $10.",
      "Tu progreso se actualizará.",
    ],
  },
  tres: {
    heroSrc: "/assets/missions/desafio-tres.png",
    category: "Cliente Frecuente",
    title: "Compra Más de Dos Veces",
    description:
      "Realiza compras separadas en el mismo comercio participante.",
    validity: "Del 1 al 31 de mayo de 2026.",
    steps: [
      "Realiza una compra en tu tienda favorita participante.",
      "Repite la compra dos veces más en la misma tienda.",
      "Tu recompensa se emitirá automáticamente.",
    ],
  },
};

/**
 * Home screen — matches the Figma "Home" frame (balance card, YaPass levels,
 * action grid, scan CTA).
 *
 * Tapping "Ver Misiones" no longer navigates away: the YaPass card expands
 * in place and the rest of the screen is swapped for the YAPASS 1 + YAPASS 2
 * frames (AdBanner, LevelsCarousel, ChallengeCard, "Ver Locales"). The
 * Beneficios tab itself is locked at the navigation level.
 */
function HomeScreenInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showWelcome, markWelcomeSeen] = useOnceFlag("yapass.welcome.seen");
  const [showChallenge, setShowChallenge] = useState(false);
  const [activeDesafio, setActiveDesafio] = useState<DesafioId | null>(null);

  // Drives the in-place "Ver Misiones" expansion. Initialised from the URL
  // so deep links (and the /beneficios redirect) land on the right view.
  const [showMisiones, setShowMisiones] = useState(false);
  // Drives the in-place "Ver Locales" pestaña. Mutually exclusive with the
  // misiones view — opening one closes the other so the back button always
  // returns to the default Home layout.
  const [showLocales, setShowLocales] = useState(false);
  // When set, the locales pestaña is in "single tienda" mode: only that
  // locale is rendered and the map is recentered + zoomed in on it. This
  // is what makes the daily-mission "Ver Ubicación" link different from
  // the generic "Ver Locales" button.
  const [focusedLocaleId, setFocusedLocaleId] = useState<string | null>(null);
  // Drives the in-place "Raspa y Gana" pestaña (intro + scratch board).
  // Like the other pestañas, it lives inside Inicio and is mutually
  // exclusive with showMisiones / showLocales.
  const [showRaspa, setShowRaspa] = useState(false);

  // Daily missions the user spawned by tapping "Quiero mi X% OFF" in
  // the campaign popup. Persisted in localStorage so they survive a
  // reload — every entry renders an extra MissionRow inside
  // "Desafíos Diarios" below.
  const { claimed: claimedCampaigns } = useClaimedCampaigns();

  useEffect(() => {
    if (searchParams.get("misiones") === "1") {
      setShowMisiones(true);
      router.replace("/");
    }
  }, [searchParams, router]);

  const openMisiones = () => {
    setShowLocales(false);
    setFocusedLocaleId(null);
    setShowRaspa(false);
    setShowMisiones(true);
  };
  const closeMisiones = () => setShowMisiones(false);

  const openLocales = (focusId: string | null = null) => {
    setShowMisiones(false);
    setShowRaspa(false);
    setFocusedLocaleId(focusId);
    setShowLocales(true);
  };
  const closeLocales = () => {
    setShowLocales(false);
    setFocusedLocaleId(null);
  };

  const openRaspa = () => {
    setShowMisiones(false);
    setShowLocales(false);
    setFocusedLocaleId(null);
    setShowRaspa(true);
  };
  const closeRaspa = () => setShowRaspa(false);

  // Geolocation only fires while the locales pestaña is open, so we never
  // ask for the prompt in the background just for visiting Inicio.
  const geo = useGeolocation({ enabled: showLocales, watch: showLocales });

  const focusedLocale = focusedLocaleId
    ? (LOCALES.find((l) => l.id === focusedLocaleId) ?? null)
    : null;
  // In single-tienda mode the map should always frame the focused store,
  // even if GPS gives us a wildly different position (e.g. user not in the
  // barrio). In "all locales" mode we prefer GPS, falling back to the
  // average of the three tiendas.
  const mapCenter = focusedLocale
    ? { lat: focusedLocale.lat, lng: focusedLocale.lng }
    : (geo.position ?? FALLBACK_CENTER);
  const visibleLocales = focusedLocale ? [focusedLocale] : LOCALES;

  const actions: ActionTileProps[] = [
    { icon: IoSwapHorizontalOutline, label: "Transferir" },
    { icon: IoBusinessOutline, label: "Transferir a otro banco", badge: "+" },
    { icon: IoWalletOutline, label: "Recargar" },
    { icon: IoCashOutline, label: "Cobrar" },
    { icon: IoArrowDownCircleOutline, label: "Retirar" },
    { icon: IoPhonePortraitOutline, label: "Recarga celular" },
    { icon: IoReaderOutline, label: "Pagar servicios" },
    { icon: IoTrainOutline, label: "Metro de Quito" },
    { icon: IoPeopleOutline, label: "Deuna Jóvenes" },
    { icon: IoStorefrontOutline, label: "Tienda Deuna" },
  ];

  // YaPass progression — refreshed to match the latest Figma:
  //   1) Regalo  (Alpina yogurt)        — completed
  //   2) $0.15   Cashback               — active
  //   3) Regalo  (Alpina yogurt sabor)  — upcoming
  //   4) $0.15   Cashback               — upcoming (locked)
  //   5) Sponsored Alpina "Raspa y Gana!"
  const levels: Level[] = [
    {
      id: "1",
      kind: "reward",
      imageSrc: "/assets/yapass/yogurt-1.png",
      label: "Regalo",
      name: "Nivel 1",
      variant: "completed",
    },
    {
      id: "2",
      amount: "$0.15",
      label: "Cashback",
      name: "Nivel 2",
      variant: "active",
    },
    {
      id: "3",
      kind: "reward",
      imageSrc: "/assets/yapass/yogurt-2.png",
      label: "Regalo",
      name: "Nivel 3",
    },
    {
      id: "4",
      amount: "$0.15",
      label: "Cashback",
      name: "Nivel 4",
    },
    {
      id: "5",
      kind: "sponsored",
      name: "Nivel 5",
      sponsor: { name: "Alpina", logoSrc: "/assets/alpina/logo.png" },
      cta: "Raspa y Gana!",
      theme: "alpina",
      onCtaClick: openRaspa,
    },
  ];

  return (
    <div
      className={cn(
        "flex flex-col",
        // The Raspa pestaña owns its full viewport (techo flush with the
        // top edge), so we skip the safe-area top padding for it.
        showRaspa ? "" : "pt-[max(env(safe-area-inset-top),0.5rem)]",
      )}
    >
      {showRaspa ? null : (
        <ScreenHeader
          location={
            showMisiones || showLocales ? "Barrio San Juan" : undefined
          }
          onBellPress={() => setShowChallenge(true)}
          onHelpPress={() => {}}
        />
      )}

      {showRaspa ? (
        // ── Raspa y Gana (in-place pestaña) ────────────────────────────────
        // Triggered from the "Raspa y Gana!" CTA on the Nivel 5 sponsored
        // chip of the YaPass carousel. Internally toggles between the intro
        // frame and the scratch board.
        <RaspaYGanaPanel onBack={closeRaspa} onClaim={() => {}} />
      ) : showLocales ? (
        // ── Locales en tu barrio (in-place pestaña) ────────────────────────
        // Triggered from "Ver Locales" / "Ver Ubicación". Replaces every
        // other Home tile with the live map + the user mascot marker.
        <div
          key="locales"
          className="flex flex-col gap-3 px-4 pt-3 pb-32 animate-[yp-expand-in_320ms_ease-out]"
        >
          <div className="flex items-center gap-2">
            <IconButton
              aria-label="Volver al inicio"
              onClick={closeLocales}
              size="sm"
              icon={<IoArrowBack className="h-5 w-5 text-ink" />}
            />
            <span className="text-sm font-semibold text-text-secondary">
              {focusedLocale ? "Ubicación de la tienda" : "Locales cerca de ti"}
            </span>
          </div>

          <Card variant="elevated" padding="lg" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-title-sm text-primary">
                  {focusedLocale ? focusedLocale.title : "Tiendas participantes"}
                </span>
                <span className="text-[12px] font-medium text-text-secondary">
                  {geo.status === "loading"
                    ? "Obteniendo tu ubicación…"
                    : geo.status === "granted" && geo.accuracy != null
                      ? `Ubicación activa · ±${Math.round(geo.accuracy)} m`
                      : geo.status === "granted"
                        ? "Ubicación activa"
                        : geo.status === "denied"
                          ? "Permiso denegado · centrado en el barrio"
                          : "Centrado en el barrio"}
                </span>
              </div>
              <button
                type="button"
                onClick={geo.refresh}
                disabled={geo.status === "loading"}
                className="text-[12px] font-semibold text-primary underline underline-offset-2 disabled:opacity-50"
              >
                Actualizar
              </button>
            </div>

            <MapSection
              center={mapCenter}
              locales={visibleLocales}
              userLocation={geo.position ?? FALLBACK_CENTER}
              userAvatarSrc="/assets/position.png"
              height={420}
              zoom={focusedLocale ? 18 : 17}
              onSelectLocal={() => {}}
            />

            <ul className="flex flex-col divide-y divide-line/70">
              {visibleLocales.map((local) => (
                <li
                  key={local.id}
                  className="flex items-center gap-3 py-2.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <IoStorefrontOutline className="h-5 w-5" />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="text-[14px] font-semibold leading-5 text-ink">
                      {local.title}
                    </span>
                    <span className="text-[12px] leading-4 text-text-secondary">
                      {local.desc}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : showMisiones ? (
        // ── YAPASS 1 + YAPASS 2 in-place view ──────────────────────────────
        // Triggered from the Home "Ver Misiones" button. Animates in from
        // the YaPass card slot, replacing every other Home tile.
        <div
          key="misiones"
          className="flex flex-col gap-4 px-4 pt-3 pb-32 animate-[yp-expand-in_320ms_ease-out]"
        >
          <div className="flex items-center gap-2">
            <IconButton
              aria-label="Volver al inicio"
              onClick={closeMisiones}
              size="sm"
              icon={<IoArrowBack className="h-5 w-5 text-ink" />}
            />
            <span className="text-sm font-semibold text-text-secondary">
              Misiones YaPass
            </span>
          </div>

          {/* YAPASS 1 — promo banner with mascot + CTA */}
          <AdBanner
            title="YaPass,"
            description={"gana recompensas\ncomprando en tu barrio."}
            ctaLabel="Ver beneficios"
            onPressCta={() => {}}
            mascot={<Mascot size={110} />}
          />

          {/* YAPASS 2 — levels carousel + weekly + daily missions */}
          <LevelsCarousel
            title="YaPass"
            levels={levels}
            currentLabel="Nivel 2"
            progress={0.55}
          />

          <MissionsCard title="Desafíos Semanales">
            <MissionRow
              iconSrc="/assets/missions/icon-tienda.png"
              description="Compra en 3 locales diferentes"
              progress={2}
              total={3}
              progressLabel="2/3"
              unit="locales"
              onMoreInfo={() => setActiveDesafio("uno")}
            />
            <MissionRow
              iconSrc="/assets/missions/icon-factura.png"
              description="Compra $10 en tu barrio"
              progress={4}
              total={10}
              progressLabel="$4/$10"
              onMoreInfo={() => setActiveDesafio("dos")}
            />
            <MissionRow
              iconSrc="/assets/missions/icon-banderas.png"
              description="5 clientes distintos realicen una compra"
              progress={5}
              total={5}
              progressLabel="5/5"
              onMoreInfo={() => setActiveDesafio("tres")}
            />
          </MissionsCard>

          <MissionsCard title="Desafíos Diarios">
            {/* User-spawned dailies: each campaign the user accepted from
                the live popup becomes its own row, newest on top. */}
            {claimedCampaigns.map((c) => {
              const matchedLocal = LOCALES.find(
                (l) =>
                  l.title.toLowerCase() === c.businessName.toLowerCase(),
              );
              return (
                <MissionRow
                  key={c.id}
                  iconSrc="/assets/missions/icon-tienda.png"
                  description={`${c.discountPct}% de Cashback en ${c.businessName}`}
                  progress={0}
                  total={1}
                  progressLabel="0/1"
                  customLink={{
                    label: "Ver Ubicación",
                    onPress: () => openLocales(matchedLocal?.id ?? null),
                  }}
                />
              );
            })}

            {/* Seed daily — kept so the section never reads empty. */}
            <MissionRow
              iconSrc="/assets/missions/icon-tienda.png"
              description="20% de Cashback en Frutería Danny"
              progress={0}
              total={1}
              progressLabel="0/1"
              customLink={{
                label: "Ver Ubicación",
                onPress: () => openLocales("2"),
              }}
            />
          </MissionsCard>

          <div className="pt-2">
            <Button label="Ver Locales" size="lg" onClick={() => openLocales()} />
          </div>
        </div>
      ) : (
        // ── Default Home layout ────────────────────────────────────────────
        <div className="flex flex-col gap-4 px-4 pt-3 pb-8">
          <BalanceCard
            amount={0.02}
            spentLast30Days={2.25}
            onPressRecharge={() => {}}
            onPressDetail={() => {}}
          />

          <Card variant="elevated" padding="lg" className="flex flex-col gap-3">
            <LevelsCarousel
              title="YaPass"
              levels={levels}
              currentLabel="Nivel 2"
              progress={0.55}
            />
            <Button
              label="Ver Misiones"
              variant="primary"
              size="md"
              onClick={openMisiones}
              fullWidth={false}
              className="self-center"
            />
          </Card>

          <ActionGrid items={actions} />

          <ScanButton onPress={() => {}} />
        </div>
      )}

      <WelcomeAdPopup
        visible={showWelcome === true}
        onClose={() => markWelcomeSeen()}
        onCta={() => {
          markWelcomeSeen();
          openMisiones();
        }}
      />

      <DesafioModal
        visible={activeDesafio !== null}
        onClose={() => setActiveDesafio(null)}
        {...(activeDesafio ? DESAFIOS[activeDesafio] : DESAFIOS.uno)}
      />

      <PopupModal
        visible={showChallenge}
        title="Nuevo Desafío!"
        description={'"¡Hay un nuevo desafío de compra!"'}
        onClose={() => setShowChallenge(false)}
      >
        <div className="flex flex-col gap-3">
          <ChallengeCard
            title=""
            description="Compra 10 dólares en tu tiendita"
            progress={3}
            total={10}
            emoji="🏪"
          />
          <Button
            label="Nuevo Desafío!"
            onClick={() => {
              setShowChallenge(false);
              openMisiones();
            }}
            size="lg"
          />
        </div>
      </PopupModal>
    </div>
  );
}

export default function HomeScreen() {
  // useSearchParams must live inside a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <HomeScreenInner />
    </Suspense>
  );
}
