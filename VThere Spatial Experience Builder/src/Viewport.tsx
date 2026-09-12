import * as THREE from "three";
import { useEffect, useRef } from "react";
import { SceneObject } from "./model";
import { AxisName, AxisArrow } from "./gizmo/types";
import { AXIS_COLORS, AXIS_HOVER_COLORS } from "./gizmo/colors";
import { closestPointOnAxis } from "./gizmo/math";
import { makeAxisArrow, extentAlong, setArrowColor } from "./gizmo/moveGizmo";
import { makeAxisScaleHandle, AxisScaleHandle, setScaleHandleColor } from "./gizmo/scaleGizmo";

interface ViewportProps {
  objects: SceneObject[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: [number, number, number]) => void;
  onScale: (id: string, scale: [number, number, number]) => void;
  interactive?: boolean;
}

const colorFor = (kind: SceneObject["assetKind"]) =>
  ({ cube: 0x4ea7a0, sphere: 0xe6ad5a, cylinder: 0xd66d75 })[kind];

export default function Viewport({
  objects,
  selectedId,
  onSelect,
  onMove,
  onScale,
  interactive = true,
}: ViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef({ objects, selectedId, onSelect, onMove, onScale });
  dataRef.current = { objects, selectedId, onSelect, onMove, onScale };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1118);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(7, 5.5, 8);
    camera.lookAt(0, 0.7, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // used for drag math: instead of moving objects by raw screen-pixel deltas,
    // we raycast teh cursor against the floor plane to get the object's real 3D position
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragIntersection = new THREE.Vector3();

    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);

    const gizmoGroup = new THREE.Group(); // kept separate from objectsGroup so syncObjects rebuilds don't touch it
    scene.add(gizmoGroup);

    // this is for move/transform feature in gizmo
    const axisArrows: AxisArrow[] = [
      makeAxisArrow("x"),
      makeAxisArrow("y"),
      makeAxisArrow("z"),
    ]; // one arrow per axis, built once
    axisArrows.forEach((arrow) => gizmoGroup.add(arrow.group));

    // this is for scale feature gizmo
    const scaleHandles: AxisScaleHandle[] = [
      makeAxisScaleHandle("x"),
      makeAxisScaleHandle("y"),
      makeAxisScaleHandle("z"),
    ]; // one arrow per axis, built once
    scaleHandles.forEach((handle) => gizmoGroup.add(handle.mesh));

    scene.add(new THREE.HemisphereLight(0xdbe9e7, 0x17222d, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(4, 8, 5);
    scene.add(keyLight);
    const grid = new THREE.GridHelper(12, 12, 0x5f8a94, 0x1a2b34);
    scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshBasicMaterial({
        color: 0x101a21,
        transparent: true,
        opacity: 0.6,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    let dragging: { id: string; offsetX: number; offsetZ: number } | null =
      null;
    let axisDragging: {
      id: string;
      axis: AxisName;
      origin: THREE.Vector3;
      direction: THREE.Vector3;
      grabT: number; // was: offset: number;
    } | null = null;
    let lastAxisDragPosition: [number, number, number] | null = null; // final position, committed once on release

    let scaleDragging: {
      id: string;
      axis: AxisName;
      origin: THREE.Vector3; // object's position, scale pivots around its own center, doesn't move
      direction: THREE.Vector3;
      grabT: number; // where along the axis clicked
      startScale: [number, number, number]; // object's scale when the drag began
    } | null = null;
    let lastScaleValue: [number, number, number] | null = null; // final scale, committed once on release

    // track the last computed position during a drag, so onPointerUp can
    // commit it once without needing to recompute or re-raycast
    let lastDragPosition: [number, number, number] | null = null;

    let renderedSignature = "";

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const syncObjects = () => {
      const signature = JSON.stringify([
        dataRef.current.objects,
        dataRef.current.selectedId,
      ]);
      if (signature === renderedSignature) return;
      objectsGroup.traverse((child) => {
        if (
          child instanceof THREE.Mesh ||
          child instanceof THREE.LineSegments
        ) {
          child.geometry.dispose();
          if (Array.isArray(child.material))
            child.material.forEach((material) => material.dispose());
          else child.material.dispose();
        }
      });
      objectsGroup.clear();
      dataRef.current.objects.forEach((item) => {
        const geometry =
          item.assetKind === "sphere"
            ? new THREE.SphereGeometry(0.65, 32, 20)
            : item.assetKind === "cylinder"
              ? new THREE.CylinderGeometry(0.55, 0.55, 1.2, 32)
              : new THREE.BoxGeometry(1.1, 1.1, 1.1);
        const material = new THREE.MeshStandardMaterial({
          color: colorFor(item.assetKind),
          roughness: 0.68,
          metalness: 0.05,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = item.id;
        mesh.position.set(...item.transform.position);
        mesh.rotation.set(...item.transform.rotation);
        mesh.scale.set(...item.transform.scale);
        if (item.id === dataRef.current.selectedId) {
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({ color: 0xf3d48b }),
          );
          mesh.add(edges);
        }
        objectsGroup.add(mesh);
      });
      renderedSignature = signature;
    };

    const gizmoGap = 0.15; // extra breathing room past the object's edge
    const ARROW_LENGTH = 0.725;

    // keeps the gizmo's position and every arrow's offset matched to the selected
    // object, each frame. Skips updates mid-drag so it doesn't fight onPointerMove
    const syncGizmo = () => {
      const selected = dataRef.current.objects.find(
        (object) => object.id === dataRef.current.selectedId,
      );
      gizmoGroup.visible = !!selected; // hide entirely when nothing's selected
      if (selected && !dragging && !axisDragging) {
        gizmoGroup.position.set(...selected.transform.position); // gizmo origin stays at object's center
        const mesh = objectsGroup.getObjectByName(selected.id);
        if (mesh) {
          axisArrows.forEach((arrow) => {
            const offset = extentAlong(mesh, arrow.axis) + gizmoGap;
            arrow.group.position.copy(arrow.direction).multiplyScalar(offset); // push each arrow outward along its own axis
          });

          scaleHandles.forEach((handle) => {
            const offset =
              extentAlong(mesh, handle.axis) + gizmoGap + ARROW_LENGTH;
            handle.mesh.position.copy(handle.direction).multiplyScalar(offset); // push each handle outward along its own axis
          });
        }
      }
    };

    const getPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pick = (event: PointerEvent) => {
      getPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(objectsGroup.children, false)[0];
      return hit?.object ?? null;
    };

    // raycasts against all three arrows, returns whichever one (if any) is under the cursor
    const pickGizmo = (
      event: PointerEvent,
    ): {
      hit: THREE.Object3D;
      axis: AxisName;
      kind: "arrow" | "scale";
    } | null => {
      getPointer(event);
      raycaster.setFromCamera(pointer, camera);
      for (const arrow of axisArrows) {
        const hit = raycaster.intersectObjects(arrow.group.children, true)[0]; // true = check body + head meshes
        if (hit) return { hit: hit.object, axis: arrow.axis, kind: "arrow" };
      }

      for (const handle of scaleHandles) {
        const hit = raycaster.intersectObject(handle.mesh, true)[0];
        if (hit) return { hit: hit.object, axis: handle.axis, kind: "scale" };
      }
      return null; // cursor isn't over any arrow
    };

    const resetAllArrowColors = () =>
      axisArrows.forEach((arrow) =>
        setArrowColor(arrow, AXIS_COLORS[arrow.axis]),
      ); // clears hover highlight off every arrow at once

    const resetAllScaleHandleColors = () =>
      scaleHandles.forEach((handle) => setScaleHandleColor(handle, AXIS_COLORS[handle.axis]));

    const onPointerDown = (event: PointerEvent) => {
      const gizmoHit = pickGizmo(event);
      if (gizmoHit) {
        if (gizmoHit.kind === "arrow") {
          // clicked an arrow, not the object body — start an axis-constrained drag instead
          const arrow = axisArrows.find((item) => item.axis === gizmoHit.axis)!; // find the matching arrow by axis, since pickGizmo now returns axis+kind, not the arrow object itself
          const selected = dataRef.current.objects.find(
            (object) => object.id === dataRef.current.selectedId,
          );
          if (selected) {
            const axisOrigin = new THREE.Vector3(...selected.transform.position); // where the object currently is
            getPointer(event);
            raycaster.setFromCamera(pointer, camera);
            const hitT = closestPointOnAxis(
              raycaster.ray.origin,
              raycaster.ray.direction,
              axisOrigin,
              arrow.direction,
            );
            if (hitT !== null) {
              axisDragging = {
                id: selected.id,
                axis: arrow.axis,
                origin: axisOrigin,
                direction: arrow.direction.clone(),
                grabT: hitT, // was: offset: -hitT,
              };
            }
          }
        }

        if (gizmoHit.kind === "scale") {
          // clicked a scale cube, start a scale drag along that axis
          const handle = scaleHandles.find((item) => item.axis === gizmoHit.axis)!; // find the matching handle by axis
          const selected = dataRef.current.objects.find(
            (object) => object.id === dataRef.current.selectedId,
          );
          if (selected) {
            const mesh = objectsGroup.getObjectByName(selected.id); // read live scale from the mesh, not stale React state, since scale isn't committed back to React yet mid-drag
            if (mesh) {
              const axisOrigin = new THREE.Vector3(...selected.transform.position);
              getPointer(event);
              raycaster.setFromCamera(pointer, camera);
              const hitT = closestPointOnAxis(
                raycaster.ray.origin,
                raycaster.ray.direction,
                axisOrigin,
                handle.direction,
              );
              if (hitT !== null) {
                scaleDragging = {
                  id: selected.id,
                  axis: handle.axis,
                  origin: axisOrigin,
                  direction: handle.direction.clone(),
                  grabT: hitT,
                  startScale: [mesh.scale.x, mesh.scale.y, mesh.scale.z], // actual current scale, not stale prop
                };
              }
            }
          }
        }

        renderer.domElement.setPointerCapture(event.pointerId);
        return;
      }

      const hit = pick(event);
      if (!hit) {
        dataRef.current.onSelect(null);
        return;
      }
      dataRef.current.onSelect(hit.name);
      const item = dataRef.current.objects.find(
        (object) => object.id === hit.name,
      );

      if (item) {
        // Find where the initial click landed on the floor plane, so we can
        // preserve the offset between "where you grabbed the object" and its
        // actual position, instead of snapping the object onto the cursor.
        dragPlane.constant = -item.transform.position[1];
        raycaster.ray.intersectPlane(dragPlane, dragIntersection);
        dragging = {
          id: item.id,
          offsetX: item.transform.position[0] - dragIntersection.x,
          offsetZ: item.transform.position[2] - dragIntersection.z,
        };
      }

      renderer.domElement.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!axisDragging && !dragging) {
        // only show hover feedback when nothing's actively being dragged
        const hovering = pickGizmo(event); // same raycast as clicking, just for feedback instead of action
        resetAllArrowColors(); // clear any previous hover highlight first
        resetAllScaleHandleColors(); // same, but for scale cubes
        if (hovering && hovering.kind === "arrow") {
          const arrow = axisArrows.find((item) => item.axis === hovering.axis)!;
          setArrowColor(arrow, AXIS_HOVER_COLORS[hovering.axis]);
        }
        if (hovering && hovering.kind === "scale") {
          const handle = scaleHandles.find((item) => item.axis === hovering.axis)!;
          setScaleHandleColor(handle, AXIS_HOVER_COLORS[hovering.axis]);
        }
      }

      if (axisDragging) {
        getPointer(event);
        raycaster.setFromCamera(pointer, camera);
        const hitT = closestPointOnAxis(
          raycaster.ray.origin,
          raycaster.ray.direction,
          axisDragging.origin,
          axisDragging.direction,
        );
        if (hitT === null) return; // degenerate camera angle this frame, skip rather than jump
        const travel = hitT - axisDragging.grabT; // how far the cursor has moved along the axis since the grab point
        const next = axisDragging.origin
          .clone()
          .addScaledVector(axisDragging.direction, travel); // apply that travel distance to the object's starting position
        const nextPos: [number, number, number] = [next.x, next.y, next.z];
        const mesh = objectsGroup.getObjectByName(axisDragging.id);
        if (mesh) mesh.position.set(...nextPos); // move mesh directly, same pattern as floor-drag
        gizmoGroup.position.set(...nextPos); // keep gizmo glued to object during this drag
        lastAxisDragPosition = nextPos; // remembered so onPointerUp can commit without recomputing
        return; // don't also run the floor-drag logic below
      }

      if (scaleDragging) {
        getPointer(event);
        raycaster.setFromCamera(pointer, camera);
        const hitT = closestPointOnAxis(
          raycaster.ray.origin,
          raycaster.ray.direction,
          scaleDragging.origin,
          scaleDragging.direction,
        );
        if (hitT === null) return; // degenerate camera angle this frame, skip rather than jump
        const travel = hitT - scaleDragging.grabT; // how far you've dragged along the axis since grabbing
        const scaleFactor = 1 + travel; // dragging outward (positive travel) grows it, inward shrinks it
        const axisIndex = scaleDragging.axis === "x" ? 0 : scaleDragging.axis === "y" ? 1 : 2;
        const nextScale: [number, number, number] = [...scaleDragging.startScale];
        nextScale[axisIndex] = Math.max(0.05, scaleDragging.startScale[axisIndex] * scaleFactor); // clamp so it can't invert or vanish
        const mesh = objectsGroup.getObjectByName(scaleDragging.id);
        if (mesh) mesh.scale.set(...nextScale); // update mesh directly, same pattern as move
        lastScaleValue = nextScale; // remembered for onPointerUp to commit later
        return;
      }

      if (!dragging) return;

      // rebuild the ray from the camera through the current cursor position,
      // uses same approach pick() uses for click selection
      getPointer(event);
      raycaster.setFromCamera(pointer, camera);

      // find exactly where that ray crosses the floor plane, and this can return
      // null in the rare case that ray is parallel to the plane, so we add a guard
      const hit = raycaster.ray.intersectPlane(dragPlane, dragIntersection);
      if (!hit) return;

      // Y is not given by horizontal plane, so keep the current height of object
      const currentY =
        dataRef.current.objects.find((object) => object.id === dragging!.id)
          ?.transform.position[1] ?? 0;

      const next: [number, number, number] = [
        dragIntersection.x + dragging.offsetX,
        currentY,
        dragIntersection.z + dragging.offsetZ,
      ];

      // instead of calling onMove (which would push a history entry every frame),
      // look up the actual mesh in the scene by name and move it directly.
      // syncObjects won't fight us here because dataRef.current.objects hasn't
      // changed, so its JSON signature check skips the rebuild
      const mesh = objectsGroup.getObjectByName(dragging.id);
      if (mesh) {
        mesh.position.set(next[0], next[1], next[2]);
      }
      gizmoGroup.position.set(next[0], next[1], next[2]); // keep gizmo glued to object while dragging, not just at rest
      // remember this so onPointerUp can commit it without recomputing anything
      lastDragPosition = next;
    };

    const onPointerUp = () => {
      if (axisDragging && lastAxisDragPosition) {
        dataRef.current.onMove(axisDragging.id, lastAxisDragPosition); // single commit, one undo entry
      }

      axisDragging = null;
      lastAxisDragPosition = null;

      if (scaleDragging && lastScaleValue) {
        dataRef.current.onScale(scaleDragging.id, lastScaleValue); // single commit, one undo entry
      }
      scaleDragging = null;
      lastScaleValue = null;

      if (dragging && lastDragPosition) {
        dataRef.current.onMove(dragging.id, lastDragPosition);
      }
      dragging = null;
      lastDragPosition = null;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    if (interactive) {
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", onPointerUp);
    }
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      syncObjects();
      syncGizmo();
      renderer.render(scene, camera);
    };
    resize();
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      objectsGroup.traverse((child) => {
        if (
          child instanceof THREE.Mesh ||
          child instanceof THREE.LineSegments
        ) {
          child.geometry.dispose();
          if (Array.isArray(child.material))
            child.material.forEach((material) => material.dispose());
          else child.material.dispose();
        }
      });

      // dispose the gizmo's geometry/materials too, same pattern as objectsGroup above
      gizmoGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material))
            child.material.forEach((material) => material.dispose()); // multi-material case
          else child.material.dispose();
        }
      });

      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [interactive]);

  return (
    <div className="viewport" ref={mountRef}>
      {interactive && (
        <div className="viewport-hint">
          Drag a selected object across the floor plane
        </div>
      )}
    </div>
  );
}
