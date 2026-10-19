/**
 * @file        RecentlyPublishedSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Overview section: museums that went live recently. View and Unpublish are
 *              shown but off until there are published museums to act on.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { PublishedItem } from "../../../api/admin";
import { Button } from "../../../ui/button";
import { StatusChip, type ChipTone } from "../../../ui/statusChip";
import { useNoLogic } from "../../../ui/noLogic";

const ACCESS: Record<PublishedItem["access"], { label: string; tone: ChipTone }> = {
  public: { label: "Public", tone: "green" },
  unlisted: { label: "Unlisted", tone: "purple" },
  sign_in: { label: "Sign-in only", tone: "grey" },
};

export function RecentlyPublishedSection({ items }: { items: PublishedItem[] }) {
  const [noLogic, noLogicPopup] = useNoLogic();
  return (
    <section className="admin-panel admin-overview-recent">
      <div className="admin-panel-head"><h2>Recently published</h2></div>
      <div className="admin-scroll">
        {items.length === 0 && <p className="admin-overview-empty">Nothing has been published yet.</p>}
        <table className="admin-table">
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>
                  <div className="admin-muted">{item.where}</div>
                </td>
                <td>{item.visits} visits</td>
                <td><StatusChip tone={ACCESS[item.access].tone}>{ACCESS[item.access].label}</StatusChip></td>
                <td className="admin-actions">
                  <Button size="small" onClick={() => noLogic(`View ${item.title}`)}>View</Button>
                  <Button size="small" variant="danger" onClick={() => noLogic(`Unpublish ${item.title}`)}>Unpublish</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {noLogicPopup}
    </section>
  );
}
