export const captureKonvaStage = (stageRef: React.RefObject<any>): string | null => {
  if (!stageRef.current) return null;
  try {
    const stage = stageRef.current;
    const padding = 40; // px padding around content

    // Find bounding box of all visible content across all layers
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;

    stage.getLayers().forEach((layer: any) => {
      layer.getChildren().forEach((node: any) => {
        // Skip guides, selection handles, grid
        const name = node.name?.() || '';
        if (name.includes('guide') || name.includes('selection') || name.includes('grid')) return;
        try {
          const rect = node.getClientRect({ relativeTo: stage, skipTransform: false });
          if (rect.width > 0 && rect.height > 0) {
            hasContent = true;
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
          }
        } catch (_) {}
      });
    });

    if (!hasContent) {
      // Fall back to full stage capture
      return stage.toDataURL({ pixelRatio: 2 });
    }

    // Apply padding, clamped to stage bounds
    const stageWidth = stage.width();
    const stageHeight = stage.height();
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(stageWidth - cropX, (maxX - minX) + padding * 2);
    const cropH = Math.min(stageHeight - cropY, (maxY - minY) + padding * 2);

    return stage.toDataURL({
      pixelRatio: 2,
      x: cropX,
      y: cropY,
      width: cropW,
      height: cropH,
    });
  } catch (e) {
    console.error('Failed to capture Konva stage', e);
    return null;
  }
};

export const captureThreeCanvas = (): string | null => {
  // Find the Three.js canvas in the DOM (assuming there's only one in the simulator)
  // Ensure the Canvas component has gl={{ preserveDrawingBuffer: true }}
  const canvas = document.querySelector('.dewatering-3d-view canvas') as HTMLCanvasElement;
  if (canvas) {
    try {
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error('Failed to capture Three.js canvas', e);
      return null;
    }
  }
  return null;
};
