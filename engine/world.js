export function createWorld(cw, ch){
  const res = new Uint8Array(cw*ch);
  const obs = new Uint8Array(cw*ch);
  return { cw, ch, res, obs };
}
