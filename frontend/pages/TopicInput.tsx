import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

interface CourseSummary {
  topic: string;
}

export default function TopicInput() {
  const [topicInput, setTopicInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [allTopics, setAllTopics] = useState<CourseSummary[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const navigate = useNavigate();

  const fetchAllTopics = async () => {
    setMessage(""); // Clear previous messages
    try {
      const response = await fetch(`${API_BASE_URL}/courses`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: CourseSummary[] = await response.json();
      setAllTopics(data);
    } catch (error) {
      console.error("Error fetching topics:", error);
      setMessage("⚠️ Unable to fetch topics. Check backend server.");
    }
  };

  useEffect(() => {
    fetchAllTopics();
  }, []);

  const handleGenerateCourseAndGame = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!topicInput.trim()) {
      setMessage("Please enter a topic!");
      return;
    }

    setLoading(true);
    setMessage("Generating first lesson (Beginner level)...");

    try {
      const generatedTopic = topicInput.trim();
      
      // Generate first lesson (Beginner level)
      const response = await fetch(
        `${API_BASE_URL}/generate-lesson/${encodeURIComponent(generatedTopic)}/Beginner`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const lesson = await response.json();
      setMessage("Lesson generated! Loading game...");
      
      // Determine game type by checking game_data structure FIRST (most reliable)
      const gameData = lesson.game_data || {};
      const gameType = (lesson.game_type || '').toLowerCase();
      
      console.log("TopicInput: Game type from lesson:", gameType);
      console.log("TopicInput: Game data keys:", Object.keys(gameData));
      
      // PRIMARY CHECK: Use game_data structure (most reliable)
      if (gameData.sentence && gameData.blanks) {
        // Has sentence and blanks = fill-in-the-blanks
        console.log("TopicInput: Detected fill-in-the-blanks from game_data structure");
        navigate(`/game/${generatedTopic}/fill/1`);
      } else if (gameData.tiles && gameData.question) {
        // Has tiles and question = tile game
        console.log("TopicInput: Detected tile game from game_data structure");
        navigate(`/game/${generatedTopic}/tiles/1`);
      } else if (gameData.blocks && gameData.correct_order) {
        // Has blocks and correct_order = puzzle (redirect to tiles for now)
        console.log("TopicInput: Detected puzzle game, redirecting to tiles");
        navigate(`/game/${generatedTopic}/tiles/1`);
      } else {
        // FALLBACK: Use game_type string
        if (gameType.includes('fill') || gameType.includes('blank')) {
          navigate(`/game/${generatedTopic}/fill/1`);
        } else {
          // Default to tiles
          navigate(`/game/${generatedTopic}/tiles/1`);
        }
      }
    } catch (error) {
      console.error("Error generating lesson:", error);
      setMessage(`⚠️ Error: ${error instanceof Error ? error.message : "Unable to generate lesson. Please check the server."}`);
      setLoading(false);
    }
  };

  return (
    <div className="page full-screen">
      <div className="orb orb1"></div>
      <div className="orb orb2"></div>
      <h1 className="title">🎮 Agentic AI Game Generator</h1>
      <p className="subtitle">Enter your study topic to begin your journey</p>

      <form onSubmit={handleGenerateCourseAndGame} className="form">
        <input
          type="text"
          placeholder="Enter a topic..."
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Generating..." : "Generate 🚀"}
        </button>
      </form>

      {message && <p className="message">{message}</p>}

      <h2 className="section-title">Available Topics</h2>
      <div className="topics-list">
        {allTopics.length > 0 ? (
          allTopics.map((summary, index) => (
            <button
              key={index}
              className={`topic-button ${
                selectedTopic === summary.topic ? "selected" : ""
              }`}
              onClick={() => navigate(`/content/${summary.topic}`)}
              disabled={loading}
            >
              {summary.topic}
            </button>
          ))
        ) : (
          <p>No topics generated yet.</p>
        )}
      </div>
    </div>
  );
}