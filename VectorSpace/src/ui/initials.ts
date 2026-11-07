/**
 * @file        initials.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The letters in an avatar circle: up to two capitals, "Demo School" -> "DS", "aisyah" -> "A".
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("") || "?";
}
