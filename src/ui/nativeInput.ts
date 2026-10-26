/**
 * WebKit may select the nearest HUD text when a game key is held, even when
 * the key itself has user-select:none. Protect the whole app, not just labels.
 * Touch cancellation is limited to the play surfaces so menus/route still scroll.
 */
export function suppressNativeSelection(app: HTMLElement, surfaces: HTMLElement[]) {
  const doc = app.ownerDocument;
  const cancel = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  const clearSelection = () => {
    const selection = doc.getSelection();
    if (!selection || selection.isCollapsed) return;
    if ((selection.anchorNode && app.contains(selection.anchorNode)) ||
        (selection.focusNode && app.contains(selection.focusNode))) selection.removeAllRanges();
  };
  const nativeEvents = ["contextmenu", "selectstart", "dragstart", "copy"];
  for (const type of nativeEvents) app.addEventListener(type, cancel, true);
  app.addEventListener("pointerdown", clearSelection, true);
  doc.addEventListener("selectionchange", clearSelection);
  // Pointer Events own all gameplay actions. This only cancels the separate
  // native TouchEvent default; it must never trigger a second jump/duck.
  for (const surface of surfaces) surface.addEventListener("touchstart", cancel, { capture: true, passive: false });
  clearSelection();
  return () => {
    for (const type of nativeEvents) app.removeEventListener(type, cancel, { capture: true });
    app.removeEventListener("pointerdown", clearSelection, { capture: true });
    doc.removeEventListener("selectionchange", clearSelection);
    for (const surface of surfaces) surface.removeEventListener("touchstart", cancel, { capture: true });
  };
}
