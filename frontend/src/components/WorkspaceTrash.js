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
  const elRef = useRef(null);

  /* Subscribe to the workspace's drag events. workspaceRef.current is often
     still null the first time this effect runs — BlocklyWorkspace assigns
     it inside its OWN mount effect, and child effects (this one) fire
     before the parent's, per React's bottom-up effect order. Poll briefly
     until it appears rather than requiring a prop change to retry. */
  useEffect(() => {
    let intervalId = null;
    let unsubscribe = () => {};

    function subscribe(ws) {
      const listener = (event) => {
        if (event.type !== Blockly.Events.BLOCK_DRAG) return;
        setHover(false);
        setVisible(!!event.isStart);
      };
      ws.addChangeListener(listener);
      unsubscribe = () => ws.removeChangeListener(listener);
    }

    const ws = workspaceRef.current;
    if (ws) {
      subscribe(ws);
    } else {
      let tries = 0;
      intervalId = setInterval(() => {
        tries += 1;
        const readyWs = workspaceRef.current;
        if (readyWs) {
          clearInterval(intervalId);
          intervalId = null;
          subscribe(readyWs);
        } else if (tries > 40) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }, 50);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      unsubscribe();
    };
  }, [workspaceRef]);

  /* Register as a Blockly delete area only while visible (i.e. for the
     duration of a drag); unregistered again on hide or unmount so a stale
     zone never lingers in the component manager. */
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws || !visible) return undefined;

    const zone = new TrashZone(
      () => (elRef.current ? elRef.current.getBoundingClientRect() : null),
      setHover,
    );
    const manager = ws.getComponentManager();
    manager.addComponent({
      component: zone,
      weight: 1,
      capabilities: DELETE_AREA_CAPABILITIES,
    });

    return () => {
      manager.removeComponent(zone.id);
    };
  }, [visible, workspaceRef]);

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
