# ThreadLab — 3D Shirt Mockup

Aplicación web interactiva para generar mockups de camisetas en 360° con React Three Fiber.

## Stack

- React + Vite + TypeScript
- Tailwind CSS + Lucide React
- `@react-three/fiber`, `@react-three/drei`, `three`
- Zustand

## Arranque

```bash
cd shirt-mockup-3d
npm install
npm run dev
```

## Funciones

- Visor 3D con OrbitControls, Environment `city` y sombras de estudio
- Modelo GLTF de camiseta (drei-assets)
- Decal PNG/JPG con posición, escala, rotación y cara frente/espalda
- Presets de color y de cámara
- Exportar render PNG (fondo de estudio o transparente)
- Drag & drop de diseños sobre el viewport

## Estructura

```
src/
  components/
    Canvas3D.tsx      # Escena, cámara, luces, export
    ShirtModel.tsx    # Malla, material, Decal
    UIOverlay.tsx     # Panel de controles
  store/
    useMockupStore.ts # Estado del mockup
  App.tsx
```
