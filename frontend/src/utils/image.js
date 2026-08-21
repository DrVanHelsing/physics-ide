/**
 * A WebGL canvas without preserveDrawingBuffer reads back as a single flat
 * colour once the frame has been composited. That is indistinguishable from a
 * successful capture unless you look at the pixels — which is why the viewport
 * screenshot has been silently exporting an empty rectangle and reporting
 * success. Detecting it is the difference between a bug and an honest error.
 */
export function isUniformImageData(data) {
  if (!data || data.length < 8) return true;
  const [r, g, b, a] = [data[0], data[1], data[2], data[3]];
  for (let i = 4; i < data.length; i += 4) {
    if (data[i] !== r || data[i + 1] !== g || data[i + 2] !== b || data[i + 3] !== a) return false;
  }
  return true;
}
