import * as THREE from "three";
import { useEffect, useRef } from "react";
import { SceneObject } from "./model";
import { AxisName, AxisArrow } from "./gizmos/types";
import { AXIS_COLORS, AXIS_HOVER_COLORS } from "./gizmos/colors";
import { closestPointOnAxis } from "./gizmos/math";
import { makeAxisArrow, extentAlong, setArrowColor } from "./gizmos/moveGizmo";

interface ViewportProps {
  objects: SceneObject[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: [number, number, number]) => void;
  interactive?: boolean;
}

const colorFor = (kind: SceneObject["assetKind"]) =>
  ({ cube: 0x4ea7a0, sphere: 0xe6ad5a, cylinder: 0xd66d75 })[kind];

export default function Viewport({
  objects,
  selectedId,
  onSelect,
  onMove,
  interactive = true,
}: ViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef({ objects, selectedId, onSelect, onMove });
  dataRef.current = { objects, selectedId, onSelect, onMove };

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

    const axisArrows: AxisArrow[] = [
      makeAxisArrow("x"),
      makeAxisArrow("y"),
      makeAxisArrow("z"),
    ]; // one arrow per axis, built once
    axisArrows.forEach((arrow) => gizmoGroup.add(arrow.group));

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
    ): { hit: THREE.Object3D; arrow: AxisArrow } | null => {
      getPointer(event);
      raycaster.setFromCamera(pointer, camera);
      for (const arrow of axisArrows) {
        const hit = raycaster.intersectObjects(arrow.group.children, true)[0]; // true = check body + head meshes
        if (hit) return { hit: hit.object, arrow }; // stop at the first arrow actually hit
      }
      return null; // cursor isn't over any arrow
    };

    const resetAllArrowColors = () =>
      axisArrows.forEach((arrow) => setArrowColor(arrow, AXIS_COLORS[arrow.axis])); // clears hover highlight off every arrow at once

    const onPointerDown = (event: PointerEvent) => {
      const gizmoHit = pickGizmo(event);
      if (gizmoHit) {
        // clicked an arrow, not the object body — start an axis-constrained drag instead
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
            gizmoHit.arrow.direction,
          );
          if (hitT !== null) {
            axisDragging = {
              id: selected.id,
              axis: gizmoHit.arrow.axis,
              origin: axisOrigin,
              direction: gizmoHit.arrow.direction.clone(),
              grabT: hitT, // was: offset: -hitT,
            };
          }
        }
        renderer.domElement.setPointerCapture(event.pointerId);
        return; // don't fall through to normal object selection below
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
        if (hovering) setArrowColor(hovering.arrow, AXIS_HOVER_COLORS[hovering.arrow.axis]); // highlight only the one under the cursor
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
          child.geometry.dispose()
          if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose()) // multi-material case
          else child.material.dispose()
        }
      })

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
