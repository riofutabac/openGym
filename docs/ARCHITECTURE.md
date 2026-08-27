# Cómo funciona openGym — mapa del código y arquitectura

Este documento describe la arquitectura modular de openGym, la persistencia en Appwrite (documentos de perfil y filas por sesión) y la estructura del frontend.

## 1. Vista general del monorepo

```
openGym/
├── frontend/             → SPA React + adaptadores de backend
│   ├── src/
│   │   ├── views/       ← Pantallas (Home, Plan, Workout, Stats, History, Library, Settings, Login)
│   │   ├── sheets.jsx   ← Modales y flujos interactivos
│   │   ├── store/       ← Estado en memoria síncrono (Zustand: useStore.js, useUI.js, sync.js)
│   │   ├── lib/
│   │   │   ├── backend/ ← Adaptadores: appwrite.js, appwriteData.js, appwriteMedia.js, local.js, compose.js
│   │   │   ├── net.js   ← Detección de conectividad y reconexión fail-safe
│   │   │   ├── progression.js, onerm.js, history.js, etc. (lógica de dominio pura)
│   │   └── components/  ← Componentes visuales desacoplados
│   ├── android/ ios/    ← Wrapper Capacitor nativo para móviles
├── scripts/             ← Herramientas de migración, sync de media y build
└── docs/                ← Guías de despliegue y arquitectura
```

## 2. El flujo de arranque (`boot()`)

`frontend/src/main.jsx` → `App.jsx` → `boot()` en `useStore.js`:

1. `App()` llama `useStore(s => s.boot)` en un `useEffect`.
2. `boot()` suscribe `onReconnect()` para sincronización en segundo plano al recuperar señal.
3. `boot()` consulta la sesión con `auth.currentUser()`:
   - **Build demo** (`VITE_DEMO=1`): siembra datos de ejemplo en memoria/localStorage (`lib/demoSeed.js`) y entra como invitado.
   - **Build estándar / móvil**: consulta la sesión activa en Appwrite (o caché offline). Si no hay sesión, muestra `Login`.
4. `pullState()` hidrata el modelo síncrono `S` en memoria:
   - Carga el documento `profiles` (ajustes, rutinas, pesajes) gobernado por `_ts`.
   - Carga la lista de sesiones de `workouts` y realiza una **fusión por ID** sin riesgo de sobreescritura del historial.
   - Drena sesiones pendientes locales a la nube a través de `syncQueue.drain()`.

## 3. Modelo de datos en Appwrite Databases / TablesDB

Persistencia granular con **Document Security** habilitado (`Permission.read/update/delete(Role.user(userId))`):

- **Tabla `profiles`** (`rowId = userId`):
  - `userId`, `ts`, `settings` (JSON), `routines` (JSON), `week` (JSON), `dayPlan` (JSON), `exWeights` (JSON), `customEx` (JSON), `bodyweight` (JSON).
- **Tabla `workouts`** (`rowId = workout.id`):
  - `userId` (indexado), `d` (indexado ISO date), `start`, `end`, `routineId`, `name`, `bw`, `vol`, `prs` (JSON), `entries` (JSON).

## 4. Invariantes y cola de sincronización offline (`sync.js`)

- **Cola como resta, no como copia duplicada**:
  - `pending = S.workouts - gym_synced_v1`.
  - La cola no mantiene un almacén de datos paralelo; lee la fuente de verdad durable en `S.workouts`. Si el índice de confirmados se pierde, la degradación es reenviar de más (absorbido por la idempotencia de `saveWorkout`), nunca perder registros.
- **Separación de banderas**:
  - `gym_profile_dirty`: gobierna exclusivamente la sincronización del perfil cuando falla `saveProfile`.
  - El estado de entrenos se maneja independientemente en `gym_synced_v1` y `gym_sync_failed_v1`.
- **Drenado secuencial y tolerancia a fallos**:
  - Los entrenos se suben uno a uno.
  - Errores `401`: abortan el drenado sin marcar fallos para proteger las credenciales.
  - Errores de cliente `4xx`: se ponen en cuarentena en `gym_sync_failed_v1` con su mensaje de error para no bloquear el resto de la cola, y se reintentan en el refresh manual.
  - Errores de red / `5xx`: se reintentan automáticamente al reconectar vía `onReconnect()`.
