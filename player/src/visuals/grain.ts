// A tile of fine paper grain, made once, laid over every background as a CSS image (it costs nothing per frame).

let tile: string | null = null;

/** A CSS url() of a 160 px tile of soft monochrome noise */
export function grainTile(): string {
  if (tile !== null) return tile;
  tile = 'none';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 160;
    const g = canvas.getContext('2d');
    if (!g) return tile;
    const pixels = g.createImageData(160, 160);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = Math.random() * 38;
    }
    g.putImageData(pixels, 0, 0);
    tile = `url(${canvas.toDataURL('image/png')})`;
  } catch {
    // No canvas: no grain
  }
  return tile;
}
