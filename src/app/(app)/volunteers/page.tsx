import { collagePhotos } from "@/lib/collage";
import { VolunteersList } from "./volunteers-list";

/**
 * A server component wrapping the client one, for a single reason: the photo
 * collage is built from whatever is sitting in `public/collage/`, and only the
 * server can look in a folder. It reads the names here, at build time, and
 * hands the list down.
 */
export default function VolunteersPage() {
  return <VolunteersList photos={collagePhotos()} />;
}
