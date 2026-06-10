export function calcPoints(
  predH: number | null | undefined,
  predA: number | null | undefined,
  realH: number | null | undefined,
  realA: number | null | undefined,
): number {
  if (
    predH == null ||
    predA == null ||
    realH == null ||
    realA == null
  )
    return 0;
  if (predH === realH && predA === realA) return 5;
  const predWinner = Math.sign(predH - predA);
  const realWinner = Math.sign(realH - realA);
  if (predWinner === realWinner) return 3;
  return 0;
}
