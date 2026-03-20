import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

interface LessonContent {
  introduction: string;
  topic_1: string;
  topic_2: string;
  topic_3: string;
  conclusion: string;
}

interface Lesson {
  lesson_name: string;
  lesson_level: string;
  lesson_content: LessonContent;
  game_type?: string;
  game_data?: TileGameData;
}

interface TileGameData {
  question?: string;
  tiles?: string[];
  answers?: string[];
  blocks?: string[];
  correct_order?: string[];
}

const LEVEL_LABELS = ["", "Beginner", "Intermediate", "Advanced"];

export default function TileGame() {
  const { topic, levelIndex } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [gameData, setGameData] = useState<TileGameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTiles, setSelectedTiles] = useState<string[]>([]);
  const [orderedBlocks, setOrderedBlocks] = useState<string[]>([]); // For puzzle games
  const [feedback, setFeedback] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Enable scroll on page
  useEffect(() => {
    document.body.style.overflowY = "auto";
    return () => {
      document.body.style.overflowY = "hidden";
    };
  }, []);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!topic || !levelIndex) return;
      const idx = parseInt(levelIndex, 10);
      const levelName = LEVEL_LABELS[idx] || "Beginner";

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `${API_BASE_URL}/courses/${encodeURIComponent(topic)}/lessons/${levelName}`
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to load lesson.");
        }

        const data = await res.json();
        
        // PRIMARY CHECK: Use game_data structure (most reliable indicator)
        const gameData = data.game_data || {};
        const actualGameType = (data.game_type || '').toLowerCase();
        
        console.log("TileGame: Game type from lesson:", actualGameType);
        console.log("TileGame: Game data keys:", Object.keys(gameData));
        
        // If game_data has sentence and blanks, it's fill-in-the-blanks - REDIRECT
        if (gameData.sentence && gameData.blanks) {
          console.log("TileGame: WRONG PAGE - Detected fill-in-the-blanks structure, redirecting...");
          navigate(`/game/${encodeURIComponent(topic!)}/fill/${levelIndex}`, { replace: true });
          return;
        }
        
        // If game_data has tiles and question, it's a tile game - STAY HERE
        if (gameData.tiles && gameData.question) {
          console.log("TileGame: CORRECT PAGE - Tile game detected");
          setLesson(data);
          setGameData(gameData);
          setSelectedTiles([]);
          setOrderedBlocks([]);
          setFeedback("");
          return;
        }
        
        // If game_data has blocks and correct_order, it's a puzzle game - STAY HERE
        if (gameData.blocks && gameData.correct_order) {
          console.log("TileGame: CORRECT PAGE - Puzzle game detected");
          setLesson(data);
          setGameData(gameData);
          // Shuffle blocks for puzzle game
          const shuffled = [...gameData.blocks].sort(() => Math.random() - 0.5);
          setOrderedBlocks(shuffled);
          setSelectedTiles([]);
          setFeedback("");
          return;
        }
        
        // FALLBACK: Check game_type string
        if (actualGameType.includes('fill') || actualGameType.includes('blank')) {
          console.log("TileGame: WRONG PAGE - game_type indicates fill-in-the-blanks, redirecting...");
          navigate(`/game/${encodeURIComponent(topic!)}/fill/${levelIndex}`, { replace: true });
          return;
        }
        
        // Default: assume it's a tile game (or puzzle which we handle on tiles page)
        console.log("TileGame: Assuming tile game (default)");
        setLesson(data);
        setGameData(gameData);
        setSelectedTiles([]);
        setOrderedBlocks([]);
        setFeedback("");
      } catch (err) {
        console.error("Error loading lesson:", err);
        setError(
          err instanceof Error ? err.message : "Unable to load lesson for this level."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [topic, levelIndex]);

  const levelName = useMemo(() => {
    if (!levelIndex) return "Beginner";
    const idx = parseInt(levelIndex, 10);
    return LEVEL_LABELS[idx] || "Beginner";
  }, [levelIndex]);

  const toggleTile = (tile: string) => {
    setSelectedTiles((prev) =>
      prev.includes(tile) ? prev.filter((t) => t !== tile) : [...prev, tile]
    );
  };

  // Puzzle game functions
  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newOrder = [...orderedBlocks];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setOrderedBlocks(newOrder);
    } else if (direction === 'down' && index < orderedBlocks.length - 1) {
      const newOrder = [...orderedBlocks];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setOrderedBlocks(newOrder);
    }
  };

  const handleSubmit = async () => {
    if (!topic || !levelName || !gameData || !lesson) return;
    setSubmitting(true);
    setFeedback("");
    try {
      // Determine submission format based on game type
      let submission: any = {};
      
      if (gameData.blocks && gameData.correct_order) {
        // Puzzle game - send ordered blocks
        submission = { ordered_blocks: orderedBlocks };
      } else {
        // Tile game - send selected tiles
        submission = { selected_tiles: selectedTiles };
      }
      
      const res = await fetch(
        `${API_BASE_URL}/evaluate/${encodeURIComponent(topic)}/${levelName}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_submission: submission,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Evaluation failed.");
      }

      const data = await res.json();
      setFeedback(
        `${data.is_correct ? "✅ Correct!" : "❌ Try again."} ${data.feedback || ""}`
      );
    } catch (err) {
      console.error("Error submitting answers:", err);
      setFeedback(
        err instanceof Error ? err.message : "Unable to evaluate answers right now."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page scroll-page">
        <h2 className="title">Loading Tile Game...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page scroll-page">
        <h2 className="title">Tile Game — Level {levelIndex}</h2>
        <p className="lesson-text" style={{ maxWidth: 700 }}>
          ⚠️ {error}
        </p>
      </div>
    );
  }

  return (
    <div className="page scroll-page">
      <h1 className="title">
        {gameData?.blocks && gameData?.correct_order 
          ? `Puzzle Blocks Game — ${lesson?.lesson_level || `Level ${levelIndex}`}`
          : `Tile Game — ${lesson?.lesson_level || `Level ${levelIndex}`}`}
      </h1>

      {lesson && (
        <section className="lesson-card" style={{ maxWidth: 900 }}>
          <h2 className="lesson-title">{lesson.lesson_name}</h2>
          <div className="lesson-text" style={{ lineHeight: 1.6 }}>
            <p>
              <strong>Introduction:</strong> {lesson.lesson_content.introduction}
            </p>
            <p>
              <strong>Concept 1:</strong> {lesson.lesson_content.topic_1}
            </p>
            <p>
              <strong>Concept 2:</strong> {lesson.lesson_content.topic_2}
            </p>
            <p>
              <strong>Concept 3:</strong> {lesson.lesson_content.topic_3}
            </p>
            <p>
              <strong>Conclusion:</strong> {lesson.lesson_content.conclusion}
            </p>
          </div>
        </section>
      )}

      <div className="tile-game-container">
        {gameData?.blocks && gameData?.correct_order ? (
          // PUZZLE GAME
          <>
            <h3 className="lesson-title">Puzzle Blocks Game</h3>
            <p className="lesson-text" style={{ marginBottom: 10 }}>
              Arrange the blocks in the correct chronological order:
            </p>
            <p className="lesson-text" style={{ fontSize: "0.9rem", opacity: 0.8 }}>
              Use the ↑ ↓ buttons to reorder the blocks.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginTop: "20px",
                width: "100%",
                maxWidth: 700,
              }}
            >
              {orderedBlocks.map((block, index) => (
                <div
                  key={`${block}-${index}`}
                  className="lesson-card"
                  style={{
                    padding: "15px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <div style={{ flex: 1 }}>{block}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <button
                      onClick={() => moveBlock(index, 'up')}
                      disabled={index === 0}
                      style={{
                        padding: "5px 10px",
                        background: index === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)",
                        border: "none",
                        borderRadius: "4px",
                        cursor: index === 0 ? "not-allowed" : "pointer",
                        color: "white",
                      }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveBlock(index, 'down')}
                      disabled={index === orderedBlocks.length - 1}
                      style={{
                        padding: "5px 10px",
                        background: index === orderedBlocks.length - 1 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)",
                        border: "none",
                        borderRadius: "4px",
                        cursor: index === orderedBlocks.length - 1 ? "not-allowed" : "pointer",
                        color: "white",
                      }}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="game-btn"
              style={{ marginTop: 30 }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Evaluating..." : "Submit Order"}
            </button>

            {feedback && (
              <p className="lesson-text" style={{ marginTop: 15 }}>
                {feedback}
              </p>
            )}
          </>
        ) : gameData?.tiles && gameData?.question ? (
          // TILE GAME
          <>
            <h3 className="lesson-title">Tile Game</h3>
            <p className="lesson-text" style={{ marginBottom: 10 }}>
              {gameData.question}
            </p>
            <p className="lesson-text" style={{ fontSize: "0.9rem", opacity: 0.8 }}>
              Select all tiles that correctly answer the question.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "12px",
                marginTop: "20px",
                width: "100%",
                maxWidth: 700,
              }}
            >
              {gameData.tiles.map((tile) => {
                const active = selectedTiles.includes(tile);
                return (
                  <button
                    key={tile}
                    className="lesson-card"
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      border: active ? "2px solid #ffd166" : "1px solid rgba(255,255,255,0.2)",
                      background: active ? "rgba(255, 209, 102, 0.15)" : "rgba(255,255,255,0.08)",
                      cursor: "pointer",
                    }}
                    onClick={() => toggleTile(tile)}
                  >
                    {tile}
                  </button>
                );
              })}
            </div>

            <button
              className="game-btn"
              style={{ marginTop: 30 }}
              onClick={handleSubmit}
              disabled={submitting || selectedTiles.length === 0}
            >
              {submitting ? "Evaluating..." : "Submit Answers"}
            </button>

            {feedback && (
              <p className="lesson-text" style={{ marginTop: 15 }}>
                {feedback}
              </p>
            )}
          </>
        ) : (
          <p className="lesson-text">
            Game content is still generating. Please check back in a moment.
          </p>
        )}
      </div>
    </div>
  );
}
