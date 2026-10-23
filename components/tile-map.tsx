"use client"

// A small street map from OpenStreetMap tiles with numbered pins: no API key,
// no library. Fits every pin, centred in a fixed 640×300 canvas that the card
// crops to its width.
// ponytail: OSM's public tile server is for light use (prototype); move to a
// tile provider with a key, or Google Maps once its keys are set, for launch.

const W = 640
const H = 300
const FIT = { w: 300, h: 230 } // pins must fit in what a phone-width card shows

const project = (lat: number, lng: number, z: number) => {
  const s = 256 * 2 ** z
  const sin = Math.sin((lat * Math.PI) / 180)
  return { x: ((lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s }
}

export type Pin = { id: string; lat: number; lng: number; label: string; kind?: "you" }

export function TileMap({ pins, selected, onSelect }: { pins: Pin[]; selected?: string; onSelect?: (id: string) => void }) {
  let z = 16
  for (; z > 3; z--) {
    const pts = pins.map((p) => project(p.lat, p.lng, z))
    const w = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))
    const h = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y))
    if (w <= FIT.w && h <= FIT.h) break
  }
  const pts = pins.map((p) => ({ ...p, ...project(p.lat, p.lng, z) }))
  const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2
  const cy = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2
  // Whole pixels, so tiles meet without seams.
  const ox = Math.round(cx - W / 2)
  const oy = Math.round(cy - H / 2)
  const tiles: { x: number; y: number }[] = []
  for (let x = Math.floor(ox / 256); x <= Math.floor((ox + W) / 256); x++)
    for (let y = Math.floor(oy / 256); y <= Math.floor((oy + H) / 256); y++) tiles.push({ x, y })

  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-lg border bg-muted" role="img" aria-label="Map of nearby branches">
      <div className="absolute top-0 left-1/2" style={{ width: W, height: H, marginLeft: -W / 2 }}>
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element -- map tiles
          <img
            key={`${t.x}-${t.y}`}
            src={`https://tile.openstreetmap.org/${z}/${t.x}/${t.y}.png`}
            alt=""
            // 1px overlap hides hairline seams between tiles on high-DPI screens.
            width={257}
            height={257}
            className="absolute block max-w-none select-none"
            style={{ left: t.x * 256 - ox, top: t.y * 256 - oy }}
            draggable={false}
          />
        ))}
        {pts.map((p) =>
          p.kind === "you" ? (
            <span
              key={p.id}
              title={p.label}
              className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow ring-4 ring-blue-600/25"
              style={{ left: p.x - ox, top: p.y - oy }}
            />
          ) : (
            <button
              key={p.id}
              type="button"
              title={p.label}
              aria-label={p.label}
              onClick={() => onSelect?.(p.id)}
              className={`absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow ${
                selected === p.id ? "z-10 scale-125 bg-red-600" : "bg-slate-700"
              }`}
              style={{ left: p.x - ox, top: p.y - oy }}
            >
              {p.label.split(".")[0]}
            </button>
          )
        )}
      </div>
      <span className="absolute right-1 bottom-1 rounded bg-white/80 px-1 text-[9px] text-slate-700">© OpenStreetMap contributors</span>
    </div>
  )
}
