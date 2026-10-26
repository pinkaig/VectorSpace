/**
 * @file        cues.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The cue table: every moment in the admin area that may move, each pointed at a recipe.
 *
 * @responsibility
 * Which moment uses which recipe. The table is complete on purpose, including the moments
 * whose motion is not decided: those are `placeholder`, so the motion board shows the gaps
 * instead of the gaps being invisible. Tier 1 cues must have a real recipe.
 * Ids are group.thing.event, named after the region of the UI and not the component file,
 * so a cue survives a component being renamed or split.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { MotionDef } from "./types";

export const CUES: MotionDef[] = [
  // popup: ui/popup.tsx. The card and its dimmed backdrop are separate cues so they can differ.
  { id: "popup.enter", label: "A popup opens", group: "popup", tier: 1, recipe: "pop-in" },
  { id: "popup.exit", label: "A popup closes", group: "popup", tier: 1, recipe: "cross-fade" },
  { id: "popup.backdrop.enter", label: "The dimmed backdrop appears", group: "popup", tier: 2, recipe: "fade" },
  { id: "popup.backdrop.exit", label: "The dimmed backdrop leaves", group: "popup", tier: 2, recipe: "cross-fade" },

  // nav: pages/AdminLayout.tsx. Opacity only: a transform on the page frame would also move its sticky table headers.
  { id: "nav.page.swap", label: "Another admin page opens", group: "nav", tier: 1, recipe: "fade" },
  { id: "nav.link.activate", label: "A sidebar link becomes the active page", group: "nav", tier: 3, recipe: "", placeholder: true, note: "Today a colour transition in AdminLayout.css; a cue only if it should do more." },

  // panel: a region of a page whose data arrives or changes
  { id: "panel.content.enter", label: "A panel's data arrives", group: "panel", tier: 1, recipe: "fade" },
  { id: "panel.content.exit", label: "A panel's old data leaves before a reload", group: "panel", tier: 2, recipe: "", placeholder: true, note: "useLoad drops the old data the moment the School picker changes, so there is nothing left on screen to fade out." },

  // table
  { id: "table.rows.enter", label: "A table's rows arrive", group: "table", tier: 2, recipe: "fade", stagger: 20 },
  { id: "table.row.status", label: "A row's status chip changes", group: "table", tier: 1, recipe: "chip-pulse" },
  { id: "table.row.added", label: "A new row is added", group: "table", tier: 2, recipe: "", placeholder: true, note: "A new row already runs table.rows.enter when it mounts." },

  // tab
  { id: "tab.switch", label: "The active filter pill moves", group: "tab", tier: 3, recipe: "", placeholder: true, note: "Today a colour transition in AdminAccountsPage.css." },

  // feedback: one shared recipe; the colour difference between saved and error is CSS
  { id: "feedback.saved", label: "A change is saved", group: "feedback", tier: 1, recipe: "chip-pulse" },
  { id: "feedback.error", label: "An error message appears", group: "feedback", tier: 1, recipe: "chip-pulse", note: "Defined, not wired yet: the role=alert paragraphs are plain <p> tags." },

  // tile
  { id: "tile.value.change", label: "A stat tile's number changes", group: "tile", tier: 3, recipe: "", placeholder: true },
];
