import React from 'react';
import { DewateringSimulationResult } from '../../utils/simulationLogic';

interface ResultsPanelProps {
  results: DewateringSimulationResult;
  onClear: () => void;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ results, onClear }) => {
  return (
    <div className="bg-white p-4 shadow-lg rounded-lg w-64 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Bill of Materials</h3>
      
      <div className="space-y-3 text-sm text-gray-700">
        <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
          <span className="font-medium">Total Perimeter:</span>
          <span>{results.totalLengthMeters.toFixed(1)}m</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Pumps:</span>
          <span className="font-bold text-blue-600">{results.pumps}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Headers:</span>
          <span className="font-bold">{results.headers}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Wellpoints:</span>
          <span className="font-bold">{results.wellpoints}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Connectors:</span>
          <span className="font-bold">{results.connectors}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Clips (2"):</span>
          <span className="font-bold">{results.clips}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Elbows:</span>
          <span className="font-bold text-orange-600">{results.elbows}</span>
        </div>

        <div className="flex justify-between items-center">
          <span>Tees (approx):</span>
          <span className="font-bold text-green-600">{results.tees}</span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t">
        <button
          onClick={onClear}
          className="w-full bg-red-50 text-red-600 hover:bg-red-100 py-2 rounded-md font-medium transition-colors"
        >
          Clear Canvas
        </button>
      </div>
    </div>
  );
};
