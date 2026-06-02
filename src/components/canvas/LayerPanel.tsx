import React from 'react';
import { Layers, Eye, EyeOff, Lock, Unlock, Plus, Trash2 } from 'lucide-react';
import { CADLayer } from '../../utils/cadDataModels';

interface LayerPanelProps {
  layers: CADLayer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (id: string, updates: Partial<CADLayer>) => void;
  onAddLayer: (layer: CADLayer) => void;
  onDeleteLayer: (id: string) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  activeLayerId,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
}) => {
  const handleAddLayer = () => {
    const newId = `layer-${Date.now()}`;
    onAddLayer({
      id: newId,
      name: `Layer ${layers.length + 1}`,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      lineType: 'solid',
      lineWeight: 1,
      visible: true,
      locked: false,
    });
    onSelectLayer(newId);
  };

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-72 flex flex-col max-h-[60vh]">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg shrink-0">
        <div className="flex items-center gap-2 text-gray-800 font-semibold">
          <Layers size={18} className="text-indigo-600" />
          <span>Layers</span>
        </div>
        <button
          onClick={handleAddLayer}
          className="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors"
          title="New Layer"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`flex items-center justify-between p-2 rounded border transition-colors cursor-pointer ${
              activeLayerId === layer.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:border-gray-200'
            }`}
            onClick={() => onSelectLayer(layer.id)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-full shrink-0 border border-gray-300"
                style={{ backgroundColor: layer.color }}
              />
              <span className={`text-sm truncate ${activeLayerId === layer.id ? 'font-medium text-indigo-900' : 'text-gray-700'}`}>
                {layer.name}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}
                className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-100 rounded"
                title="Toggle Visibility"
              >
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button
                onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
                className="p-1 text-gray-500 hover:text-rose-600 hover:bg-rose-100 rounded"
                title="Toggle Lock"
              >
                {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
              {layers.length > 1 && layer.id !== 'layer-0' && (
                <button
                  onClick={() => onDeleteLayer(layer.id)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Delete Layer"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
