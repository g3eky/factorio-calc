// The page's UI scale (CSS zoom on the root). Pointer and viewport positions are in screen
// pixels; positions set in CSS get multiplied by the zoom, so divide them by it.
export const uiZoom = () => parseFloat(document.documentElement.style.zoom) || 1
