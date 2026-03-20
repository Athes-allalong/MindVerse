import React from "react";
import { useNavigate } from "react-router-dom";

interface LessonContent {
  introduction: string;
  topic_1: string;
  topic_2: string;
  topic_3: string;
  conclusion: string;
}

interface Lesson {
  lesson_name: string;
  lesson_content: LessonContent;
  lesson_level: string;
  game_type?: string;
}

interface LevelCardProps {
  index: number;
  lesson: Lesson;
  unlocked: boolean;
  gameType: string;
  topic: string; // topic passed from parent
}

const LevelCard: React.FC<LevelCardProps> = ({
  index,
  lesson,
  unlocked,
  gameType,
  topic,
}) => {
  const navigate = useNavigate();

  const handlePlay = () => {
    if (!unlocked) return;
    // use naming variations tolerant to backend values
    const normalized = (gameType || "").toLowerCase();
    if (normalized.includes("fill")) {
      navigate(`/level/${encodeURIComponent(topic)}/${index}`);
    } else {
      // tile or default
      navigate(`/level/${encodeURIComponent(topic)}/${index}`);
    }
  };

  return (
    <div className={`level-card ${unlocked ? "unlocked" : "locked"}`}>
      <h3>
        Level {index}: <span style={{ fontWeight: 600 }}>{lesson.lesson_name}</span>
      </h3>
      <p>Game: {gameType === "tiles" || gameType === "tile" ? "Tile Game" : "Fill in the Blanks"}</p>

      {unlocked ? (
        <button className="game-btn" onClick={handlePlay}>
          Open
        </button>
      ) : (
        <button className="game-btn locked" disabled>
          Locked
        </button>
      )}
    </div>
  );
};

export default LevelCard;
