// The PlayCanvas engine ships typed, but its ESM helper scripts don't. Only what we use.
declare module "playcanvas/scripts/esm/camera-controls.mjs" {
  import type { Script, Vec2, Vec3 } from "playcanvas"
  export class CameraControls extends Script {
    enableFly: boolean
    enableOrbit: boolean
    enablePan: boolean
    moveSpeed: number
    moveFastSpeed: number
    moveSlowSpeed: number
    rotateSpeed: number
    zoomSpeed: number
    zoomRange: Vec2
    focus(point: Vec3, resetZoom?: boolean): void
    reset(focus: Vec3, position: Vec3): void
  }
}
