import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatRoute, parseRoute } from "@/hooks/use-hash-route"
import { formatCamera, parseCamera } from "./view-link.ts"

const pose = {
  position: [0.1, 1.6, -2] as [number, number, number],
  target: [0.1, 1.2, -6.5] as [number, number, number],
}

describe("camera link", () => {
  it("writes position then target, at two decimals", () => {
    assert.equal(formatCamera(pose), "0.10,1.60,-2.00,0.10,1.20,-6.50")
    assert.equal(
      formatCamera({ position: [1.234, -0.004, 8], target: [1.235, 2, 9] }),
      "1.23,0.00,8.00,1.24,2.00,9.00",
    )
  })

  it("reads a pose back, and drops a value that is not a view", () => {
    assert.deepEqual(parseCamera(formatCamera(pose)), {
      position: [0.1, 1.6, -2],
      target: [0.1, 1.2, -6.5],
    })
    assert.equal(parseCamera(null), null)
    assert.equal(parseCamera(""), null)
    assert.equal(parseCamera("0,1,2,3,4"), null)
    assert.equal(parseCamera("a,1,2,3,4,5"), null)
    assert.equal(parseCamera("0,1,2,0,1,2"), null)
    assert.equal(parseCamera("0,1,200,0,1,-1"), null)
    assert.deepEqual(parseCamera(" 0.50, 1.60, -3.00, 0.50, 1.20, -8.00 "), {
      position: [0.5, 1.6, -3],
      target: [0.5, 1.2, -8],
    })
  })

  it("keeps the camera on a room link and drops a bad one", () => {
    const cam = formatCamera(pose)
    const route = parseRoute(`?room=workshop&object=pump&part=IMP-10&q=pump&cam=${cam}`)
    assert.deepEqual(route, {
      level: "room",
      room: "workshop",
      object: "pump",
      part: "IMP-10",
      q: "pump",
      cam,
    })
    assert.equal(formatRoute(route), `?room=workshop&object=pump&part=IMP-10&cam=${cam}&q=pump`)

    const broken = parseRoute("?room=workshop&object=pump&cam=nope")
    assert.equal(broken.level, "room")
    if (broken.level === "room") assert.equal(broken.cam, null)
    assert.equal(formatRoute(broken).includes("cam"), false)

    assert.equal(parseRoute(`?cam=${cam}`).level, "parts")
  })
})
