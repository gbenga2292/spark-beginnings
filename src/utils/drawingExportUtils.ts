export const captureKonvaStage = (
  stageRef: React.RefObject<any>,
  exportArea?: { x: number; y: number; width: number; height: number },
  options?: { includeBlueprint?: boolean }
): string | null => {
  if (!stageRef.current) return null;
  try {
    const stage = stageRef.current;
    
    // Hide UI elements (Lock and Pin)
    const hiddenNodes: any[] = [];
    const changedTexts: any[] = [];
    
    stage.find((node: any) => {
      // Hide blueprint if requested
      if (options?.includeBlueprint === false && node.id() === 'blueprint-underlay') {
        hiddenNodes.push(node);
        node.hide();
      }
      
      // Hide nodes with name hide-on-export
      if (node.name && typeof node.name === 'function') {
        const n = node.name();
        if (typeof n === 'string' && n.includes('hide-on-export')) {
          hiddenNodes.push(node);
          node.hide();
        }
      }

      // Check if it's a Text node
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

    let cropX, cropY, cropW, cropH;

    if (exportArea) {
      const scaleX = stage.scaleX();
      const scaleY = stage.scaleY();
      const stageX = stage.x();
      const stageY = stage.y();
      
      cropX = exportArea.x * scaleX + stageX;
      cropY = exportArea.y * scaleY + stageY;
      cropW = exportArea.width * scaleX;
      cropH = exportArea.height * scaleY;
    } else {
      const padding = 40; // px padding around content

      // Find bounding box of all visible content across all layers
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasContent = false;

      stage.getLayers().forEach((layer: any) => {
        layer.getChildren().forEach((node: any) => {
          // Skip guides, selection handles, grid, blueprint underlay, or layer background shapes
          const name = (typeof node.name === 'function' ? node.name() : node.name) || '';
          const id = (typeof node.id === 'function' ? node.id() : node.id) || '';
          if (
            id === 'blueprint-underlay' ||
            id === 'grid-layer' ||
            name.includes('guide') ||
            name.includes('selection') ||
            name.includes('grid') ||
            name.includes('background')
          ) return;
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
        hiddenNodes.forEach(n => n.show());
        changedTexts.forEach(({ node, oldText }) => node.text(oldText));
        return stage.toDataURL({ pixelRatio: 2 });
      }

      // Apply padding around content
      cropX = minX - padding;
      cropY = minY - padding;
      cropW = (maxX - minX) + padding * 2;
      cropH = (maxY - minY) + padding * 2;
    }

    const dataUrl = stage.toDataURL({
      pixelRatio: 2,
      x: cropX,
      y: cropY,
      width: cropW,
      height: cropH,
    });

    // Restore UI elements
    hiddenNodes.forEach(n => n.show());
    changedTexts.forEach(({ node, oldText }) => node.text(oldText));

    return dataUrl;
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
