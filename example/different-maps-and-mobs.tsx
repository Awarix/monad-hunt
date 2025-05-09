import { useState, useEffect } from "react";

type Hunt = {
  id: string;
  name: string;
  gridSize: number;
  maxMoves: number;
  mobCount: number;
  status: "open" | "completed";
};

type Position = {
  x: number;
  y: number;
};

export default function TreasureHuntGame() {
  const [hunts, setHunts] = useState<Hunt[]>([
    { id: "1", name: "Golden Quest", gridSize: 5, maxMoves: 10, mobCount: 3, status: "open" },
    { id: "2", name: "Pirate's Loot", gridSize: 7, maxMoves: 15, mobCount: 4, status: "open" },
    { id: "3", name: "Mystic Cave", gridSize: 10, maxMoves: 25, mobCount: 5, status: "open" },
    { id: "4", name: "Dragon's Lair", gridSize: 5, maxMoves: 10, mobCount: 3, status: "completed" },
  ]);
  const [activeHunt, setActiveHunt] = useState<Hunt | null>(null);
  const [playerPosition, setPlayerPosition] = useState<Position>({ x: 0, y: 0 });
  const [treasurePosition, setTreasurePosition] = useState<Position>({ x: 0, y: 0 });
  const [mobPositions, setMobPositions] = useState<Position[]>([]);
  const [moves, setMoves] = useState(0);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [path, setPath] = useState<Position[]>([{ x: 0, y: 0 }]);
  const [showOGCard, setShowOGCard] = useState(false);

  // Generate random position, ensuring it's not on player, treasure, or other mobs
  const generateRandomPosition = (gridSize: number, exclude: Position[]) => {
    let newPos: Position;
    do {
      newPos = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
      };
    } while (exclude.some((pos) => pos.x === newPos.x && pos.y === newPos.y));
    return newPos;
  };

  // Join a hunt
  const joinHunt = (hunt: Hunt) => {
    if (hunt.status === "open") {
      setActiveHunt(hunt);
      const playerPos = { x: 0, y: 0 };
      const treasurePos = generateRandomPosition(hunt.gridSize, [playerPos]);
      let excludePositions = [playerPos, treasurePos];
      const newMobPositions: Position[] = [];
      for (let i = 0; i < hunt.mobCount; i++) {
        const mobPos = generateRandomPosition(hunt.gridSize, excludePositions);
        newMobPositions.push(mobPos);
        excludePositions.push(mobPos);
      }
      setPlayerPosition(playerPos);
      setTreasurePosition(treasurePos);
      setMobPositions(newMobPositions);
      setMoves(0);
      setGameStatus("playing");
      setPath([playerPos]);
      setShowOGCard(false);
    }
  };

  // Move a single mob randomly
  const moveMob = (mobPos: Position, gridSize: number) => {
    const directions = [
      { x: 0, y: -1 }, // up
      { x: 0, y: 1 },  // down
      { x: -1, y: 0 }, // left
      { x: 1, y: 0 },  // right
    ];
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    return {
      x: Math.max(0, Math.min(gridSize - 1, mobPos.x + randomDir.x)),
      y: Math.max(0, Math.min(gridSize - 1, mobPos.y + randomDir.y)),
    };
  };

  // Handle arrow key movement and game logic
  useEffect(() => {
    if (!activeHunt || gameStatus !== "playing") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      let newPosition = { ...playerPosition };
      switch (e.key) {
        case "ArrowUp":
          newPosition.y = Math.max(0, playerPosition.y - 1);
          break;
        case "ArrowDown":
          newPosition.y = Math.min(activeHunt.gridSize - 1, playerPosition.y + 1);
          break;
        case "ArrowLeft":
          newPosition.x = Math.max(0, playerPosition.x - 1);
          break;
        case "ArrowRight":
          newPosition.x = Math.min(activeHunt.gridSize - 1, playerPosition.x + 1);
          break;
        default:
          return;
      }

      if (newPosition.x !== playerPosition.x || newPosition.y !== playerPosition.y) {
        setPlayerPosition(newPosition);
        setPath((prev) => [...prev, newPosition]);
        setMoves((prev) => prev + 1);

        // Move all mobs
        const newMobPositions = mobPositions.map((mobPos) =>
          moveMob(mobPos, activeHunt.gridSize)
        );
        setMobPositions(newMobPositions);

        // Check win condition
        if (newPosition.x === treasurePosition.x && newPosition.y === treasurePosition.y) {
          setGameStatus("won");
          setHunts((prev) =>
            prev.map((h) =>
              h.id === activeHunt.id ? { ...h, status: "completed" } : h
            )
          );
        }
        // Check lose conditions
        else if (moves + 1 >= activeHunt.maxMoves) {
          setGameStatus("lost");
          setHunts((prev) =>
            prev.map((h) =>
              h.id === activeHunt.id ? { ...h, status: "completed" } : h
            )
          );
        }
        // Check if any mob hits player
        else if (
          newMobPositions.some(
            (mobPos) => mobPos.x === newPosition.x && mobPos.y === newPosition.y
          )
        ) {
          setGameStatus("lost");
          setHunts((prev) =>
            prev.map((h) =>
              h.id === activeHunt.id ? { ...h, status: "completed" } : h
            )
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeHunt, playerPosition, treasurePosition, mobPositions, moves, gameStatus]);

  // Generate OG Card URL
  const generateOGCardUrl = () => {
    const pathString = path.map((p) => `${p.x},${p.y}`).join("|");
    return `https://og-image.vercel.app/Treasure%20Hunt%20Result?path=${encodeURIComponent(
      pathString
    )}&status=${gameStatus}&theme=dark`;
  };

  // Reset game and return to hunt list
  const resetGame = () => {
    setActiveHunt(null);
    setShowOGCard(false);
  };

  if (!activeHunt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 to-amber-200 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-2xl w-full border-4 border-black">
          <h1 className="text-3xl font-bold text-black uppercase tracking-wider text-center mb-6">
            Treasure Hunts
          </h1>
          <div className="space-y-4">
            {hunts.map((hunt) => (
              <div
                key={hunt.id}
                className="flex items-center justify-between bg-teal-100 rounded-lg p-4 border-4 border-black"
              >
                <div>
                  <h2 className="text-xl font-bold text-black uppercase">
                    {hunt.name}
                  </h2>
                  <p className="text-sm text-black">
                    Grid: {hunt.gridSize}x{hunt.gridSize} | Max Moves: {" "}
                    {hunt.maxMoves} | Mobs: {hunt.mobCount} | Status: {hunt.status}
                  </p>
                </div>
                <button
                  onClick={() => joinHunt(hunt)}
                  disabled={hunt.status === "completed"}
                  className={`font-bold py-2 px-4 rounded-full border-4 border-black transition-transform ${
                    hunt.status === "open"
                      ? "bg-yellow-400 text-black hover:scale-105"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {hunt.status === "open" ? "Join Hunt" : "Completed"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-400 to-amber-200 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-3xl w-full border-4 border-black">
        <h1 className="text-3xl font-bold text-black uppercase tracking-wider text-center mb-4">
          {activeHunt.name}
        </h1>
        <div className="mb-4 text-center">
          <p className="text-lg font-semibold text-black">
            Moves: {moves}/{activeHunt.maxMoves}
          </p>
          {gameStatus !== "playing" && (
            <p
              className={`text-lg font-bold ${
                gameStatus === "won" ? "text-teal-500" : "text-red-500"
              }`}
            >
              {gameStatus === "won"
                ? "You Won!"
                : gameStatus === "lost" && moves >= activeHunt.maxMoves
                ? "Out of Moves!"
                : "Caught by Mob!"}
            </p>
          )}
        </div>
        <div
          className={`grid gap-1 mb-6`}
          style={{ gridTemplateColumns: `repeat(${activeHunt.gridSize}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: activeHunt.gridSize * activeHunt.gridSize }).map(
            (_, index) => {
              const x = index % activeHunt.gridSize;
              const y = Math.floor(index / activeHunt.gridSize);
              const isPlayer =
                x === playerPosition.x && y === playerPosition.y;
              const isTreasure =
                x === treasurePosition.x &&
                y === treasurePosition.y &&
                (gameStatus !== "playing" || isPlayer);
              const isMob =
                mobPositions.some((mob) => mob.x === x && mob.y === y) && !isPlayer;
              const isPath = path.some((p) => p.x === x && p.y === y);

              return (
                <div
                  key={index}
                  className={`w-12 h-12 rounded-lg border-4 border-black flex items-center justify-center transition-transform duration-200 ${
                    isPath ? "bg-pink-300" : "bg-teal-100"
                  } ${isPlayer || isTreasure || isMob ? "scale-110" : ""}`}
                >
                  {isPlayer && (
                    <div className="w-6 h-6 bg-yellow-400 rounded-full border-4 border-black" />
                  )}
                  {isTreasure && (
                    <div className="w-6 h-6 bg-purple-400 rounded-full border-4 border-black" />
                  )}
                  {isMob && (
                    <div className="w-6 h-6 bg-red-500 rounded-full border-4 border-black" />
                  )}
                </div>
              );
            }
          )}
        </div>
        {gameStatus !== "playing" && (
          <div className="text-center">
            <button
              onClick={() => setShowOGCard(true)}
              className="bg-yellow-400 text-black font-bold py-2 px-4 rounded-full border-4 border-black hover:scale-105 transition-transform mb-4"
            >
              Generate OG Card
            </button>
            {showOGCard && (
              <div className="mb-4">
                <img
                  src={generateOGCardUrl()}
                  alt="OG Card"
                  className="w-full rounded-lg border-4 border-black"
                />
              </div>
            )}
            <button
              onClick={resetGame}
              className="bg-teal-400 text-black font-bold py-2 px-4 rounded-full border-4 border-black hover:scale-105 transition-transform"
            >
              Back to Hunts
            </button>
          </div>
        )}
        <p className="text-sm text-black text-center mt-4">
          Use arrow keys to move. Find the treasure in {activeHunt.maxMoves}{" "}
          moves or less, and avoid the {activeHunt.mobCount} mobs!
        </p>
      </div>
    </div>
  );
}
