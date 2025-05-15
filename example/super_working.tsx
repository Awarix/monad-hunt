import React, { useState } from 'react';
import Head from 'next/head';

type TreasureType = 'common' | 'rare' | 'epic';

interface FormData {
  huntId: string;
  treasureType: TreasureType;
  moves: number;
  maxMoves: number;
  adventurers: string;
  found: boolean;
  path: string;
  treasureX: number;
  treasureY: number;
}

const DEFAULT_FORM_DATA: FormData = {
  huntId: '13',
  treasureType: 'epic',
  moves: 7,
  maxMoves: 10,
  adventurers: 'Alice, Bob, Charlie',
  found: true,
  path: '0,0;1,0;2,0;3,0;3,1;3,2;3,3;4,3',
  treasureX: 4,
  treasureY: 3
};

const OGImageGenerator = () => {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'moves' || name === 'maxMoves' || name === 'treasureX' || name === 'treasureY') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const generatePreview = () => {
    // In a real implementation, this would call the Vercel OG API
    // For this demo, we'll just create a URL with query parameters
    const params = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => {
      params.append(key, String(value));
    });
    
    // In a real app, this would be the actual OG endpoint
    const url = `/api/og?${params.toString()}`;
    setPreviewUrl(url);
  };

  // Parse path string into coordinates
  const pathCoordinates = formData.path.split(';')
    .map(coord => coord.split(',').map(Number))
    .filter(coord => coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1]));

  // Generate grid for preview
  const renderGrid = () => {
    const gridSize = 10;
    const cellSize = 40;
    const gridWidth = gridSize * cellSize;
    const gridHeight = gridSize * cellSize;
    
    // Create a 2D array to track which cells are in the path
    const grid = Array(gridSize).fill(0).map(() => Array(gridSize).fill(false));
    pathCoordinates.forEach(([x, y]) => {
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        grid[y][x] = true;
      }
    });

    return (
      <svg width={gridWidth} height={gridHeight} className="border-2 border-black bg-white">
        {/* Grid lines */}
        {Array(gridSize + 1).fill(0).map((_, i) => (
          <React.Fragment key={`grid-line-${i}`}>
            <line 
              x1={0} 
              y1={i * cellSize} 
              x2={gridWidth} 
              y2={i * cellSize} 
              stroke="black" 
              strokeWidth="1"
            />
            <line 
              x1={i * cellSize} 
              y1={0} 
              x2={i * cellSize} 
              y2={gridHeight} 
              stroke="black" 
              strokeWidth="1"
            />
          </React.Fragment>
        ))}
        
        {/* Path cells */}
        {grid.map((row, y) => 
          row.map((isPath, x) => {
            if (isPath) {
              return (
                <rect 
                  key={`path-${x}-${y}`}
                  x={x * cellSize} 
                  y={y * cellSize} 
                  width={cellSize} 
                  height={cellSize} 
                  fill="#5eead4" /* Teal color for path */
                  stroke="black"
                  strokeWidth="2"
                />
              );
            }
            return null;
          })
        )}
        
        {/* Path lines connecting centers */}
        {pathCoordinates.length > 1 && (
          <polyline
            points={pathCoordinates.map(([x, y]) => 
              `${x * cellSize + cellSize/2},${y * cellSize + cellSize/2}`
            ).join(' ')}
            fill="none"
            stroke="black"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5,5"
          />
        )}
        
        {/* Treasure location */}
        {formData.treasureX >= 0 && formData.treasureX < gridSize && 
         formData.treasureY >= 0 && formData.treasureY < gridSize && (
          <g transform={`translate(${formData.treasureX * cellSize + cellSize/2 - 12}, ${formData.treasureY * cellSize + cellSize/2 - 12})`}>
            <rect 
              width="24" 
              height="24" 
              fill={formData.treasureType === 'common' ? '#facc15' : 
                    formData.treasureType === 'rare' ? '#0ea5e9' : 
                    '#f59e0b'} /* Color based on rarity */
              stroke="black"
              strokeWidth="2"
              rx="4"
            />
            <text 
              x="12" 
              y="17" 
              textAnchor="middle" 
              fill="black" 
              fontWeight="bold"
              fontSize="16"
            >
              T
            </text>
          </g>
        )}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-200 to-red-300 p-6">
      <Head>
        <title>OG Image Generator</title>
      </Head>
      
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Treasure Hunt OG Image Generator</h1>
        
        <div className="bg-white border-2 border-black rounded-lg p-6 shadow-lg mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Input Parameters</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block font-semibold mb-1">Hunt ID</label>
              <input 
                type="text" 
                name="huntId" 
                value={formData.huntId} 
                onChange={handleInputChange}
                className="w-full border-2 border-black rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block font-semibold mb-1">Treasure Type</label>
              <select 
                name="treasureType" 
                value={formData.treasureType} 
                onChange={handleInputChange}
                className="w-full border-2 border-black rounded px-3 py-2"
              >
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
              </select>
            </div>
            
            <div>
              <label className="block font-semibold mb-1">Moves</label>
              <input 
                type="number" 
                name="moves" 
                value={formData.moves} 
                onChange={handleInputChange}
                min="0"
                className="w-full border-2 border-black rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block font-semibold mb-1">Max Moves</label>
              <input 
                type="number" 
                name="maxMoves" 
                value={formData.maxMoves} 
                onChange={handleInputChange}
                min="1"
                className="w-full border-2 border-black rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block font-semibold mb-1">Treasure X</label>
              <input 
                type="number" 
                name="treasureX" 
                value={formData.treasureX} 
                onChange={handleInputChange}
                min="0"
                max="9"
                className="w-full border-2 border-black rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block font-semibold mb-1">Treasure Y</label>
              <input 
                type="number" 
                name="treasureY" 
                value={formData.treasureY} 
                onChange={handleInputChange}
                min="0"
                max="9"
                className="w-full border-2 border-black rounded px-3 py-2"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block font-semibold mb-1">Adventurers (comma separated)</label>
              <input 
                type="text" 
                name="adventurers" 
                value={formData.adventurers} 
                onChange={handleInputChange}
                className="w-full border-2 border-black rounded px-3 py-2"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block font-semibold mb-1">Path (format: x,y;x,y;x,y)</label>
              <textarea 
                name="path" 
                value={formData.path} 
                onChange={handleInputChange}
                rows={2}
                className="w-full border-2 border-black rounded px-3 py-2"
              />
            </div>
            
            <div className="flex items-center">
              <input 
                type="checkbox" 
                name="found" 
                checked={formData.found} 
                onChange={handleInputChange}
                className="mr-2 h-5 w-5 border-2 border-black"
              />
              <label className="font-semibold">Treasure Found</label>
            </div>
          </div>
          
          <button 
            onClick={generatePreview}
            className="bg-amber-500 text-black font-bold py-2 px-6 border-2 border-black rounded hover:bg-amber-600 transition-colors"
          >
            Generate Preview
          </button>
        </div>
        
        <div className="bg-white border-2 border-black rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-800">OG Image Preview</h2>
          
          <div className="bg-yellow-500 border-2 border-black rounded-lg p-4 mb-4">
            <div className="bg-white border-2 border-black rounded-lg p-4">
              <div className="flex flex-col items-center">
                <div className="mb-4 text-center">
                  <h3 className="text-2xl font-bold">Hunt #{formData.huntId}</h3>
                  <div className={`text-xl font-bold ${formData.found ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formData.found ? 'Treasure Found!' : 'Treasure Not Found'}
                  </div>
                </div>
                
                <div className="mb-4">
                  {renderGrid()}
                </div>
                
                <div className="grid grid-cols-3 gap-4 w-full text-center">
                  <div className="border-2 border-black rounded-lg p-2 bg-white">
                    <div className="font-bold">Adventurers</div>
                    <div>{formData.adventurers}</div>
                  </div>
                  
                  <div className="border-2 border-black rounded-lg p-2 bg-white">
                    <div className="font-bold">Treasure</div>
                    <div className={`
                      ${formData.treasureType === 'common' ? 'text-yellow-500' : ''}
                      ${formData.treasureType === 'rare' ? 'text-sky-500' : ''}
                      ${formData.treasureType === 'epic' ? 'text-amber-500' : ''}
                      font-semibold
                    `}>
                      {formData.treasureType.charAt(0).toUpperCase() + formData.treasureType.slice(1)}
                    </div>
                  </div>
                  
                  <div className="border-2 border-black rounded-lg p-2 bg-white">
                    <div className="font-bold">Moves</div>
                    <div>{formData.moves}/{formData.maxMoves}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {previewUrl && (
            <div className="mt-4">
              <h3 className="font-bold mb-2">Generated URL:</h3>
              <div className="bg-gray-100 p-3 rounded border border-gray-300 break-words">
                <code>{previewUrl}</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OGImageGenerator;
