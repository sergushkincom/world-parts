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
    /** Share of the way left after each ms of a focus/reset flight; 0 jumps. Library default 0.98. */
    focusDamping: number
    /** Where the live pose is looking. A shared vector: clone it before the next camera call. */
    readonly focusPoint: Vec3
    focus(point: Vec3, resetZoom?: boolean): void
    reset(focus: Vec3, position: Vec3): void
  }
}
