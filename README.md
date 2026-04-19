# YaPass (Next.js)

Migración del proyecto original (Expo + React Native) de `d:\fft\YaPass` a
**Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4**.

Todo el código React Native fue reescrito a HTML + Tailwind para eliminar la
dependencia de Expo y asegurar que la app no se rompa por incompatibilidades
de React Native Web.

**Iconos:** `react-icons/io5` (Ionicons), mismo set que usaba el proyecto Expo
vía `@expo/vector-icons`, pero renderizado como SVG nativos.

## Puesta en marcha

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de producción
npm run start   # servir el build
npm run lint
```

## Estructura

```
src/
  app/
    layout.tsx              # Layout raíz (metadata, viewport, contenedor móvil)
    globals.css             # Tokens del design system + utilidades Tailwind
    (tabs)/
      layout.tsx            # Tab bar inferior persistente
      page.tsx              # Home  (antes app/(tabs)/index.tsx)
      beneficios/page.tsx   # Beneficios / YAPASS
      billetera/page.tsx    # Billetera
      tu/page.tsx           # Perfil
    mapa/page.tsx           # Mapa (fuera del tab bar, como en el stack original)
  components/yapass/        # Button, Card, BalanceCard, ActionGrid/Tile,
                            # AdBanner, ChallengeCard, LevelsCarousel, Mascot,
                            # PopupModal, ScanButton, ScreenHeader,
                            # WelcomeAdPopup, Input
  hooks/
    use-once-flag.ts        # Versión web del hook (localStorage +
                            # useSyncExternalStore)
  lib/
    tokens.ts               # Colores del brand para usos runtime (p. ej. mapa)
    cn.ts                   # Helper para combinar classNames
public/
  assets/                   # Copia de YaPass/assets (mascota.png, icon.png,
                            # logos y splash originales)
src/app/icon.png            # Favicon (auto-detectado por Next.js)
```

## Mapeos clave de la migración

| Expo / RN                          | Next.js / Web                           |
| ---------------------------------- | --------------------------------------- |
| `expo-router` `<Stack>` + `<Tabs>` | `src/app/(tabs)/layout.tsx` con tabs    |
| `useRouter()` de `expo-router`     | `useRouter()` de `next/navigation`      |
| `View`, `Text`, `Pressable`        | `div`, `span`, `button`                 |
| `StyleSheet.create`                | Clases Tailwind + CSS variables         |
| `@expo/vector-icons` (Ionicons)    | `react-icons/io5` (mismos Ionicons)     |
| `@react-native-async-storage/...`  | `window.localStorage` (dentro del hook) |
| `react-native-webview` (MapLibre)  | `react-map-gl` + `maplibre-gl` (nativo) |
| `SafeAreaView`                     | `env(safe-area-inset-*)` en padding     |
| `Modal` (RN)                       | Portal-less modal con overlay fijo      |
| `expo-image` `<Image>`             | `next/image`                            |

## Design system

Los tokens de `YaPass/constants/design-system.ts` se expusieron como CSS
variables dentro de `@theme` en `globals.css`, por lo que Tailwind genera
utilidades automáticamente:

- Colores: `bg-primary`, `text-ink`, `bg-primary-soft`, `text-teal`, `bg-level-gray`, etc.
- Radios: `rounded-[var(--radius-lg)]` (xs/sm/md/lg/xl).
- Sombras: `shadow-[var(--shadow-card)]`, `shadow-[var(--shadow-elevated)]`.
- Tipografía: utilidades `@utility` que clonan la escala de Figma:
  `text-display-lg`, `text-title-lg`, `text-title-md`, `text-title-sm`,
  `text-body-lg`, `text-body`, `text-body-sm`, `text-caption`,
  `text-label-button`.

La paleta sigue disponible como módulo TypeScript en `src/lib/tokens.ts`
para usos runtime (p. ej. construir el HTML embebido del mapa de MapLibre).

## Rutas

- `/` → Home
- `/beneficios` → YAPASS / misiones
- `/billetera` → Saldo y movimientos
- `/tu` → Perfil
- `/mapa` → Mapa de locales (sin tab bar, como en el stack original)

## Notas

- El proyecto se pensó mobile-first: el layout raíz centra el contenido en
  un contenedor de `max-w-[480px]` con una sombra suave para simular la
  UI del celular en viewports grandes.
- El tab bar inferior usa `position: fixed` + `env(safe-area-inset-bottom)`
  para respetar el home indicator en iOS.
- `WelcomeAdPopup` sólo se muestra en la primera visita del navegador,
  persistido en `localStorage` bajo la clave `yapass.welcome.seen`.

ESTE ES EL WIN COMMMMMMITT AAAAAAAAAAAAAAAAAAAAA
