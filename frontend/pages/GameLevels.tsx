import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import LevelCard from "../components/LevelCard";
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
}

export default function GameLevels() {
  const { topic } = useParams();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [unlockedLevel, setUnlockedLevel] = useState(1);

  useEffect(() => {
    if (topic) {
      const storedUnlockedLevel = localStorage.getItem(`unlockedLevel-${topic}`);
      setUnlockedLevel(storedUnlockedLevel ? parseInt(storedUnlockedLevel) : 1);
    }
  }, [topic]);

  useEffect(() => {
    document.body.style.overflowY = "auto";
    return () => {
      document.body.style.overflowY = "hidden";
    };
  }, []);

  useEffect(() => {
    const fetchLessons = async () => {
      if (!topic) return;
      try {
        const res = await fetch(`${API_BASE_URL}/courses/${encodeURIComponent(topic || "")}/lessons`);

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.detail || "Failed to fetch lessons.");
        }

        const data = await res.json();
        setLessons(data);
        localStorage.setItem(`lessons-${topic}`, JSON.stringify(data));
      } catch (error) {
        console.error("Error fetching lessons:", error);
        alert(`⚠️ Error fetching lessons: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };
    if (topic) {
      fetchLessons();
    }
  }, [topic]);

  return (
    <div className="page full-screen">
      <h1 className="title">Game Levels – {topic}</h1>
      <p className="subtitle">Each level has an AI-recommended game type based on the content</p>
      
      <div className="levels-grid">
        {lessons.map((lesson, idx) => (
          <LevelCard
            key={idx}
            index={idx + 1}
            lesson={lesson}
            unlocked={idx + 1 <= unlockedLevel}
            gameType={lesson.game_type || "tile"}
            topic={topic || ""} // Pass the topic prop
          />
        ))}
      </div>
    </div>
  );
}
