/**
 * @file        field.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       A labelled form field (label above, 14px ExtraBold) so every form looks the same.
 *              Wrap an input or select; the input styling is in field.css.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { ReactNode } from "react";
import "./field.css";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ui-field">
      <span className="ui-field-label">{label}</span>
      {children}
    </label>
  );
}
