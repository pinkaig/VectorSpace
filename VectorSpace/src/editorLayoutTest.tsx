import { useState } from "react";
import { EditorLayout } from "./editor/layout/editorLayout";
import { SlotPlaceholder } from "./ui/slotPlaceholder";
import { ObjectPanel, type ObjectPanelItem, type ObjectPanelTool } from "./sections/objectPanel/objectPanel";
import type { InteractionRule } from "@vectorspace/project";

// fake object and rules so the object panel can be tried here without the editor
const fakeObject: ObjectPanelItem = {
  id: "fake-1",
  name: "Pedestal",
  kind: "pedestal",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};
const fakeRules: InteractionRule[] = [
  { id: "rule-1", objectId: "fake-1", triggers: ["click"], actions: [{ kind: "playAudio", params: { assetId: "sfx-chime" } }] },
];

export function LayoutTest() {
  const [showPanel, setShowPanel] = useState(true);
  const [object, setObject] = useState(fakeObject);
  const [step, setStep] = useState(1);
  const [tool, setTool] = useState<ObjectPanelTool | null>("move");
  const [snap, setSnap] = useState(false);

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
        rightPanel={showPanel ? (
          <ObjectPanel
            object={object}
            step={step}
            onStepChange={setStep}
            onClose={() => setShowPanel(false)}
            tool={tool}
            onToolChange={setTool}
            onRotateBy={(degrees) => setObject((o) => ({ ...o, rotation: [o.rotation[0], (((o.rotation[1] + degrees) % 360) + 360) % 360, o.rotation[2]] }))}
            onExactChange={(field, value) => setObject((o) => ({ ...o, [field]: value }))}
            snap={snap}
            onSnapChange={setSnap}
            onCopy={() => console.log("copy", object.id)}
            onRemove={() => console.log("remove", object.id)}
            rules={fakeRules}
            onAddRule={(choice) => console.log("add rule", choice)}
            onRemoveRule={(ruleId) => console.log("remove rule", ruleId)}
          />
        ) : undefined}
        catalogue={<SlotPlaceholder label="Catalogue" />}
      />
    </>
  );
}