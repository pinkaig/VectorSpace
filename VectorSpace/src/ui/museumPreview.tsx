/**
 * @file        museumPreview.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Picture of a museum for cards (sign-in carousel, home pages).
 *              Shows the project's own picture when there is one, otherwise a
 *              shared demo screenshot of a real room, until projects save
 *              their own thumbnails. Can switch to a 3D view later without
 *              changing the pages that use it.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import "./museumPreview.css";

// a real screenshot from the editor, used for every project until each has its own
const DEMO_PICTURE = "previews/placeholder-thumbnail.webp";

type MuseumPreviewProps = {
  imageUrl?: string;
  title: string;
};

export function MuseumPreview({ imageUrl = DEMO_PICTURE, title }: MuseumPreviewProps) {
  return <img className="museum-preview" src={imageUrl} alt={title} />;
}