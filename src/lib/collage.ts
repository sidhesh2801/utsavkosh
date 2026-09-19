import fs from "node:fs";
import path from "node:path";

/**
 * The festival photographs, read off disk rather than out of a list.
 *
 * Whoever is keeping this running is a committee member with a phone full of
 * pictures, not someone who is going to edit an array in a TypeScript file. So
 * the folder *is* the list: drop the photos in `public/collage/`, push, and
 * they are on the page.
 *
 * Read on the server at build time, which is when the folder and the deployed
 * files are the same thing. The browser can't list a directory and a serverless
 * function can't be relied on to still have `public/` beside it, so neither is
 * asked to.
 *
 * Filename order, so `01-handi.jpg`, `02-prasad.jpg` puts them in the order the
 * evening actually happened.
 */

const DIR = path.join(process.cwd(), "public", "collage");
const IMAGE = /\.(jpe?g|png|webp|avif)$/i;

export function collagePhotos(): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(DIR);
  } catch {
    // No folder yet. An empty collage renders as nothing at all, which is the
    // right answer before anyone has added a picture.
    return [];
  }
  return names
    .filter((n) => !n.startsWith(".") && IMAGE.test(n))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((n) => `/collage/${encodeURIComponent(n)}`);
}
