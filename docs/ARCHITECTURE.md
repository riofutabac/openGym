# Cómo funciona openGym — mapa del código y arquitectura

Este documento describe la arquitectura modular de openGym, la persistencia en Appwrite (documentos de perfil y filas por sesión) y la estructura del frontend.

## 1. Vista general del monorepo

```
openGym/
├── frontend/             → SPA React + adaptadores de backend
│   ├── src/
│   │   ├── views/       ← Pantallas (Home, Plan, Workout, Stats, History, Library, Settings, Login)
│   │   ├── sheets.jsx   ← Modales y flujos interactivos
│   │   ├── store/       ← Estado en memoria síncrono (Zustand: useStore.js, useUI.js)
│   │   ├── lib/
│   │   │   ├── backend/ ← Adaptadores: appwrite.js, appwriteData.js, local.js, compose.js
│   │   │   ├── progression.js, onerm.js, history.js, etc. (lógica de dominio pura)
│   │   └── components/  ← Componentes visuales desacoplados
│   ├── android/ ios/    ← Wrapper Capacitor nativo para móviles
├── scripts/             ← Herramientas de migración y build
└── docs/                ← Guías de despliegue y arquitectura
```

## 2. El flujo de arranque (`boot()`)

`frontend/src/main.jsx` → `App.jsx` → `boot()` en `useStore.js`:

1. `App()` llama `useStore(s => s.boot)` en un `useEffect`.
2. `boot()` consulta la sesión con `auth.currentUser()`:
   - **Build demo** (`VITE_DEMO=1`): siembra datos de ejemplo en memoria/localStorage (`lib/demoSeed.js`) y entra como invitado.
   - **Build estándar / móvil**: consulta la sesión activa en Appwrite (o caché offline). Si no hay sesión, muestra `Login`.
3. `pullState()` hidrata el modelo síncrono `S` en memoria:
   - Carga el documento `profiles` (ajustes, rutinas, pesajes) gobernado por `_ts`.
   - Carga la lista de sesiones de `workouts` y realiza una **fusión por ID** sin riesgo de sobreescritura del historial.

## 3. Modelo de datos en Appwrite Databases / TablesDB

Persistencia granular con **Document Security** habilitado (`Permission.read/update/delete(Role.user(userId))`):

- **Tabla `profiles`** (`rowId = userId`):
  - `userId`, `ts`, `settings` (JSON), `routines` (JSON), `week` (JSON), `exWeights` (JSON), `customEx` (JSON), `bodyweight` (JSON).
- **Tabla `workouts`** (`rowId = workout.id`):
  - `userId` (indexado), `d` (indexado ISO date), `start`, `end`, `routineId`, `name`, `bw`, `vol`, `prs` (JSON), `entries` (JSON).

## 4. Invariantes y offline-first

- **Idempotencia de entrenos**: Cada sesión se identifica por un ID determinista (`w.id`). Escribir o sincronizar dos veces no genera duplicados.
- **Reducción de conflicto**: Las sesiones terminadas son inmutables y se unen por ID. El conflicto de `_ts` y `gym_dirty` solo aplica a la edición de rutinas en el perfil.
- **Aislamiento**: Ninguna consulta de datos o llamada de red existe fuera del directorio `src/lib/backend/`.
