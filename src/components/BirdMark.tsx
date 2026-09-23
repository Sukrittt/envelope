/** Mobile's splash/BirdLandingMark.tsx outline, shared by the static and thinking marks. */
const BIRD_PATH =
  'M 352 212 L 404 248 L 352 284 A 110 110 0 0 1 146 288 L 86 164 L 162 178 A 110 110 0 0 1 352 212 Z M 287 216 A 19 19 0 1 1 325 216 A 19 19 0 1 1 287 216 Z'

function Bird() {
  return (
    <>
      <rect x="224" y="340" width="17" height="46" rx="8.5" />
      <rect x="259" y="340" width="17" height="46" rx="8.5" />
      <path fillRule="evenodd" d={BIRD_PATH} />
    </>
  )
}

/** Static twin of Mobile's splash/BirdLandingMark.tsx artwork, painted in currentColor. */
export function BirdMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <rect x="128" y="379" width="256" height="26" rx="13" />
      <Bird />
    </svg>
  )
}

/** Money Brain's "thinking" mark: the perched bird pecks twice, rests, repeats. Motion lives in `.brain-thinking` CSS. */
export function BirdThinking({ size }: { size: number }) {
  return (
    <svg className="brain-thinking" width={size} height={size} viewBox="0 0 512 512" fill="currentColor" role="img" aria-label="Thinking">
      <rect x="128" y="379" width="256" height="26" rx="13" />
      <g className="brain-thinking-bird"><Bird /></g>
    </svg>
  )
}
