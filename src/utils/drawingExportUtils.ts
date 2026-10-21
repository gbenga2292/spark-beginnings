export const captureKonvaStage = (
  stageRef: React.RefObject<any>,
  exportArea?: { x: number; y: number; width: number; height: number },
  options?: { includeBlueprint?: boolean }
): string | null => {
  if (!stageRef.current) return null;
  const stage = stageRef.current;

  // Preserve original stage transform
  const origPos = stage.position();
  const origScale = { x: stage.scaleX(), y: stage.scaleY() };

  const hiddenNodes: any[] = [];
  const changedTexts: any[] = [];

  try {
    // 1. Temporarily hide UI elements, selection handles, guides, grid, and transformers
    stage.find((node: any) => {
      const name = (typeof node.name === 'function' ? node.name() : node.name) || '';
      const id = (typeof node.id === 'function' ? node.id() : node.id) || '';
      const className = (node.getClassName ? node.getClassName() : node.className) || '';

      // Hide blueprint if requested not to include
      if (options?.includeBlueprint === false && id === 'blueprint-underlay') {
        hiddenNodes.push(node);
        node.hide();
        return;
      }

      // Hide transformers
      if (className === 'Transformer') {
        hiddenNodes.push(node);
        node.hide();
        return;
      }

      // Hide grid layer
      if (id === 'grid-layer' || name.includes('canvas-grid') || name.includes('grid-layer')) {
        hiddenNodes.push(node);
        node.hide();
        return;
      }

      // Hide nodes marked hide-on-export, selection box, or snap indicators
      if (
        name.includes('hide-on-export') ||
        name.includes('guide') ||
        name.includes('selection') ||
        name.includes('snap-indicator')
      ) {
        hiddenNodes.push(node);
        node.hide();
        return;
      }

      // Clean up UI lock/pin icons in text annotations for clean presentation
      if (node.text && typeof node.text === 'function') {
        const textVal = node.text();
        if (typeof textVal === 'string') {
          if (textVal.includes('🔒')) {
            changedTexts.push({ node, oldText: textVal });
            node.text(textVal.replace('🔒 ', '').replace('🔒', ''));
          }
          if (textVal === '📌') {
            hiddenNodes.push(node);
            node.hide();
          }
        }
      }
    });

    let cropX: number, cropY: number, cropW: number, cropH: number;

    if (exportArea) {
      cropX = exportArea.x;
      cropY = exportArea.y;
      cropW = exportArea.width;
      cropH = exportArea.height;
    } else {
      // 2. Temporarily set stage to (0,0) and scale 1 to accurately measure model/world coordinates
      stage.position({ x: 0, y: 0 });
      stage.scale({ x: 1, y: 1 });

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasContent = false;

      // Find bounding box across all visible content
      stage.getLayers().forEach((layer: any) => {
        layer.getChildren().forEach((node: any) => {
          if (!node.visible()) return;

          const name = (typeof node.name === 'function' ? node.name() : node.name) || '';
          const id = (typeof node.id === 'function' ? node.id() : node.id) || '';
          const className = (node.getClassName ? node.getClassName() : node.className) || '';

          // Skip UI, grid, guide, selection, transformer
          if (
            id === 'grid-layer' ||
            name.includes('grid') ||
            name.includes('canvas-grid') ||
            name.includes('guide') ||
            name.includes('selection') ||
            name.includes('snap') ||
            name.includes('preview') ||
            name.includes('hide-on-export') ||
            className === 'Transformer'
          ) {
            return;
          }

          // Check for blueprint underlay
          if (id === 'blueprint-underlay') {
            if (options?.includeBlueprint === false) return;
          }

          // Skip editor grid lines that might not have an explicit name
          if (className === 'Line') {
            const opacity = typeof node.opacity === 'function' ? node.opacity() : node.opacity;
            const stroke = typeof node.stroke === 'function' ? node.stroke() : node.stroke;
            if (opacity === 0.5 && stroke === '#cbd5e1') {
              return;
            }
          }

          try {
            const rect = node.getClientRect({ skipTransform: false });
            if (
              rect.width > 0 &&
              rect.height > 0 &&
              isFinite(rect.x) &&
              isFinite(rect.y) &&
              isFinite(rect.width) &&
              isFinite(rect.height) &&
              rect.width < 50000 &&
              rect.height < 50000
            ) {
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
        // Fallback: restore and capture entire stage
        stage.position(origPos);
        stage.scale(origScale);
        hiddenNodes.forEach(n => n.show());
        changedTexts.forEach(({ node, oldText }) => node.text(oldText));
        stage.batchDraw();
        return stage.toDataURL({ pixelRatio: 2 });
      }

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      // Add tight 3% padding (min 20px, max 45px) around the actual content
      const padding = Math.max(20, Math.min(45, Math.max(contentW, contentH) * 0.03));

      cropX = minX - padding;
      cropY = minY - padding;
      cropW = contentW + padding * 2;
      cropH = contentH + padding * 2;
    }

    // Shift stage so that (cropX, cropY) is placed exactly at (0, 0)
    stage.position({ x: -cropX, y: -cropY });
    stage.scale({ x: 1, y: 1 });

    const maxDim = Math.max(cropW, cropH);
    const pixelRatio = maxDim > 3500 ? 1.5 : 2;

    const dataUrl = stage.toDataURL({
      pixelRatio,
      x: 0,
      y: 0,
      width: Math.round(cropW),
      height: Math.round(cropH),
    });

    return dataUrl;
  } catch (e) {
    console.error('Failed to capture Konva stage', e);
    return null;
  } finally {
    // ALWAYS restore original stage position, scale, and visibility
    stage.position(origPos);
    stage.scale(origScale);
    hiddenNodes.forEach(n => n.show());
    changedTexts.forEach(({ node, oldText }) => node.text(oldText));
    stage.batchDraw();
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
