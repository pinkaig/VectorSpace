/**
 * @file        museumPreview.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Picture of a museum for cards (sign-in carousel, home pages).
 *              Shows a thumbnail image for now; can switch to a 3D view later
 *              without changing the pages that use it.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

// @ts-ignore CSS is loaded by the bundler; it has no TypeScript module declaration.
import './museumPreview.css'

type MuseumPreviewProps = {
  imageUrl?: string
  title: string
}

export function MuseumPreview({ imageUrl, title }: MuseumPreviewProps) {
  if (imageUrl) {
    return <img className="museum-preview" src={imageUrl} alt={title} />
  }
  return <div className="museum-preview museum-preview-empty" />
}