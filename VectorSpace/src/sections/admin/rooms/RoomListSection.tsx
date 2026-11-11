/**
 * @file        RoomListSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Rooms & assets section: one titled list of things with a switch each. Used
 *              for both Environments and Asset packs, since they look the same.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { ReactNode } from "react";
import type { RoomItem } from "../../../api/admin";
import { Button } from "../../../ui/button";
import { Toggle } from "../../../ui/toggle";
import { useNoLogic } from "../../../ui/noLogic";

type RoomListSectionProps = {
  title: string;
  note: string;
  items: RoomItem[];
  onToggle: (itemId: string, enabled: boolean) => void;
  // "upload" adds the + Upload environment button, which is off until uploading is built
  extra?: "upload";
  // shown under the note, e.g. a link to where the items are made
  children?: ReactNode;
};

export function RoomListSection({ title, note, items, onToggle, extra, children }: RoomListSectionProps) {
  const [noLogic, noLogicPopup] = useNoLogic();
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>{title}</h2>
        {extra === "upload" && <Button variant="add" onClick={() => noLogic("Upload environment")}>+ Upload environment</Button>}
      </div>
      <p className="admin-rooms-note">{note}</p>
      {children && <p className="admin-rooms-note">{children}</p>}

      <div className="admin-scroll">
        {items.map((item) => (
          <div key={item.id} className="admin-rooms-row">
            <div>
              <div className="admin-rooms-name">{item.name}</div>
              <div className="admin-rooms-desc">
                {item.description}{item.itemCount !== undefined && ` · ${item.itemCount} items`}
              </div>
            </div>
            <Toggle
              checked={item.enabled}
              label={`${item.name} for this school`}
              disabled={item.locked}
              text={item.locked ? "Always on" : undefined}
              onChange={(next) => onToggle(item.id, next)}
            />
          </div>
        ))}
      </div>
      {noLogicPopup}
    </section>
  );
}
