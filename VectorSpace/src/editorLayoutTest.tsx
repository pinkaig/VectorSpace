import { useState } from "react";
import { EditorLayout } from "./editor/layout/editorLayout";
import { SlotPlaceholder } from "./ui/slotPlaceholder";

export function LayoutTest() {
  const [showPanel, setShowPanel] = useState(true);

  return (
    <>
      <button
        onClick={() => setShowPanel(!showPanel)}
        style={{ position: "fixed", bottom: 80, right: 24, zIndex: 10 }}
      >
        Toggle panel
      </button>

      <EditorLayout
        topBar={<SlotPlaceholder label="Top bar" />}
        viewport={<SlotPlaceholder label="3D view" />}
        cornerTopLeft={<SlotPlaceholder label="Mission brief" />}
        cornerTopRight={<SlotPlaceholder label="View angles" />}
        cornerBottomLeft={<SlotPlaceholder label="Things list" />}
        cornerBottomRight={<SlotPlaceholder label="Zoom / walls" />}
        rightPanel={showPanel ? <SlotPlaceholder label="Object panel" /> : undefined}
        catalogue={<SlotPlaceholder label="Catalogue" />}
      />
    </>
  );
}