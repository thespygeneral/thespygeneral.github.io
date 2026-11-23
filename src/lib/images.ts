// Screenshots are shrunk before saving (max 2400px, WebP/JPEG) so journals and backups stay small.

const MAX = 2400;

export async function prepareScreenshot(file: Blob): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't a picture.");
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.88));
    if (out && out.type === "image/webp" && out.size < file.size) return out;
    const jpg = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    return jpg && jpg.size < file.size ? jpg : file;
  } catch {
    return file; // unusual formats: keep the original
  }
}
