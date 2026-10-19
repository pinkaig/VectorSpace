/**
 * @file        noLogic.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       For a button that is drawn but does nothing yet: it opens a popup saying so,
 *              so a tester is never left wondering whether the click worked.
 *              Delete the call when the button gets real logic.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Popup } from "./popup";

// usage: const [noLogic, noLogicPopup] = useNoLogic();
//        <Button onClick={() => noLogic("View")}>View</Button>   ...and render {noLogicPopup} once
export function useNoLogic(): [(what: string) => void, ReactNode] {
  const [what, setWhat] = useState<string | null>(null);
  const popup = what !== null && (
    <Popup
      title="Placeholder button"
      subtitle="This part of the screen is only drawn. It has no logic yet."
      onClose={() => setWhat(null)}
      actions={<Button variant="primary" onClick={() => setWhat(null)}>OK</Button>}
    >
      <p>"{what}" does nothing yet. Nothing was changed or sent.</p>
    </Popup>
  );
  return [setWhat, popup];
}
