import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { useState, useEffect } from "react";
import TransitionOverlay from "../components/TransitionOverlay";

export default function LevelDetail() {
  const { topic, levelIndex } = useParams();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [gameType, setGameType] = useState("tiles");
  const [loading, setLoading] = useState(true);

  const [showTransition, setShowTransition] = useState(false);
  const navigate = useNavigate();

  // Enable scrolling on this page
  useEffect(() => {
    document.body.style.overflowY = "auto";
    return () => {
      document.body.style.overflowY = "hidden";
    };
  }, []);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!topic || !levelIndex) return;
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/courses/${encodeURIComponent(topic)}/lessons`
        );

        const lessons = await res.json();
        const first = lessons[0];

        const idx = Number(levelIndex);

        if (idx === 1) setContent(first.lesson_content.topic_1);
        if (idx === 2) setContent(first.lesson_content.topic_2);
        if (idx === 3) setContent(first.lesson_content.topic_3);

        setGameType(first.game_type || "tiles");
        setTitle(`${first.lesson_name} — Part ${idx}`);
      } catch {
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [topic, levelIndex]);

  const handlePlay = () => {
    setShowTransition(true);

    setTimeout(() => {
      const safeTopic = topic ?? "";
      const safeLevelIndex = levelIndex ?? "";
      const gameRoute =
        gameType.includes("fill")
          ? `/game/${safeTopic}/fill/${safeLevelIndex}`
          : `/game/${safeTopic}/tiles/${safeLevelIndex}`;

      navigate(gameRoute, {
        state: { content, topic: safeTopic, levelIndex: safeLevelIndex, gameType },
      });
    }, 1800);
  };

  if (loading)
    return (
      <div className="page full-screen">
        <h2 className="title">Loading Level...</h2>
      </div>
    );

  return (
    <div className="page scroll-page">
      {showTransition && <TransitionOverlay />}

      <h1 className="title">{title}</h1>

      <div className="lesson-card" style={{ maxWidth: 800 }}>
        <p className="lesson-text">{content}</p>
      </div>

      <button className="game-btn" onClick={handlePlay}>
        🎮 Let’s Play
      </button>

      <button className="game-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>
    </div>
  );
}
