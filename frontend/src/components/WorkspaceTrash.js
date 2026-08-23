import React, { useEffect, useRef, useState } from "react";
import Blockly from "../utils/blockly/blocklyLib";
import { TrashLidIcon } from "./Icons";

/* A Blockly delete area: the canvas queries getClientRect() during a drag to
   test hover, and calls onDragEnter/onDragExit/onDrop as the dragged block
   crosses its bounds. Registering it (see the DELETE_AREA + DRAG_TARGET
   capabilities below) is what makes Blockly's own drag system dispose of a
   block dropped here — no custom drop handling needed on our side. */
class TrashZone extends Blockly.DeleteArea {
  constructor(getRect, setHover) {
    super();
    this.id = "physicsTrashZone";
    this.getRect = getRect;
    this.setHover = setHover;
  }
  getClientRect() {
    const r = this.getRect();
    return r ? new Blockly.utils.Rect(r.top, r.bottom, r.left, r.right) : null;
  }
  onDragEnter() { this.setHover(true); }
  onDragExit() { this.setHover(false); }
  onDrop() { this.setHover(false); }
}

const DELETE_AREA_CAPABILITIES = [
  Blockly.ComponentManager.Capability.DELETE_AREA,
  Blockly.ComponentManager.Capability.DRAG_TARGET,
];

/**
 * WorkspaceTrash — the entire delete surface for the Blockly workspace.
 * No can at rest; a block drag fades it in bottom-right, and it doubles
 * as a Blockly delete area so the native drag system handles disposal
 * (including its built-in shrink animation). Blockly's stock trashcan is
 * turned off in BlocklyWorkspace.js — this component replaces it fully.
 */
function WorkspaceTrash({ workspaceRef }) {
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const elRef = useRef(null);

  /* Resolve the workspace. workspaceRef.current is often still null the
     first time this effect runs — BlocklyWorkspace assigns it inside its
     OWN mount effect, and child effects (this one) fire before the
     parent's, per React's bottom-up effect order. Poll briefly until it
     appears rather than requiring a prop change to retry, then hold it in
     state so the effects below can key off it. */
  useEffect(() => {
    let intervalId = null;

    const ws = workspaceRef.current;
    if (ws) {
      setWorkspace(ws);
    } else {
      let tries = 0;
      intervalId = setInterval(() => {
        tries += 1;
        const readyWs = workspaceRef.current;
        if (readyWs) {
          clearInterval(intervalId);
          intervalId = null;
          setWorkspace(readyWs);
        } else if (tries > 40) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }, 50);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [workspaceRef]);

  /* Subscribe to the workspace's drag events for the can's visibility. */
  useEffect(() => {
    if (!workspace) return undefined;

    const listener = (event) => {
      if (event.type !== Blockly.Events.BLOCK_DRAG) return;
      setHover(false);
      setVisible(!!event.isStart);
      /* Re-snapshot the drag-target cache at the START of every drag. See
         the registration effect below for why the cache exists at all; the
         reason to refresh it HERE is that the can is positioned against the
         workspace wrapper, so anything that resizes that wrapper WITHOUT
         firing a Blockly resize — dragging the drawer divider, for
         instance — leaves the cached rect pointing at where the can used
         to be. Re-recording per drag costs one getBoundingClientRect and
         makes the hit box correct by construction. */
      if (event.isStart) workspace.recordDragTargets();
    };
    workspace.addChangeListener(listener);
    return () => workspace.removeChangeListener(listener);
  }, [workspace]);

  /* Register as a Blockly delete area ONCE, for the life of the component —
     NOT per-drag.

     This ordering is load-bearing and was the cause of a real defect: the
     can faded in and the zone registered, but blocks dropped on it were
     never deleted and the lid never opened. Blockly does not consult
     delete areas live. WorkspaceSvg.getDragTarget() reads a cached array,
     `dragTargetAreas`, built by recordDragTargets() — which Blockly calls
     in exactly two places, workspace injection and updateScreenCalculations
     (resize/scroll). It is NEVER called at drag start. So a zone that
     registers in response to a drag beginning has already missed the only
     snapshot that matters, every single time.

     Registering at mount is still one step behind injection (the parent
     injects the workspace in its own effect, which runs after this child's),
     so we call recordDragTargets() ourselves right after adding the
     component — that is what actually puts the zone in the cache.

     Leaving the zone registered at rest is harmless: getDragTarget is only
     consulted mid-drag, and the element is always laid out (it is hidden
     with opacity, not display), so its rect is real whether or not a drag
     is in progress. */
  useEffect(() => {
    if (!workspace) return undefined;

    const zone = new TrashZone(
      () => (elRef.current ? elRef.current.getBoundingClientRect() : null),
      setHover,
    );
    const manager = workspace.getComponentManager();
    manager.addComponent({
      component: zone,
      weight: 1,
      capabilities: DELETE_AREA_CAPABILITIES,
    });
    workspace.recordDragTargets();

    return () => {
      manager.removeComponent(zone.id);
      workspace.recordDragTargets();
    };
  }, [workspace]);

  /* The rail-tint hint (workspace.css) keys off this class on the workspace
     wrapper — our own rendered container's parent. */
  useEffect(() => {
    const wrapper = elRef.current ? elRef.current.parentElement : null;
    if (!wrapper) return undefined;
    wrapper.classList.toggle("is-dragging-block", visible);
    return () => wrapper.classList.remove("is-dragging-block");
  }, [visible]);

  const classes = ["workspace-trash"];
  if (visible) classes.push("workspace-trash--visible");
  if (hover) classes.push("workspace-trash--hover");

  return (
    <div ref={elRef} className={classes.join(" ")}>
      <TrashLidIcon size={26} />
    </div>
  );
}

export default WorkspaceTrash;
