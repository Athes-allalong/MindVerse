import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import LevelCard from "../components/LevelCard";

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

interface LevelItem {
  index: number;
  title: string;
  content: string;
  gameType?: string;
  lessonLevel?: string;
}

export default function ContentPage() {
  const { topic } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [, setMessage] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [, setRawLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    const fetchLessons = async () => {
      if (!topic) return;
      setLoading(true);
      setMessage("");
      try {
        const res = await fetch(
          `${API_BASE_URL}/courses/${encodeURIComponent(topic)}/lessons`
        );
        if (!res.ok) {
          if (res.status === 404) {
            setMessage(
              "No lessons found yet. If you just generated the course, please wait a bit and try again."
            );
            setLevels([]);
            setIntroduction("");
            return;
          }
          throw new Error("Failed to fetch lessons");
        }
        const lessons: Lesson[] = await res.json();
        setRawLessons(lessons);

        // We expect at least one lesson with lesson_content
        const first = lessons[0];
        if (!first || !first.lesson_content) {
          setMessage("No structured lesson content found.");
          return;
        }
        setIntroduction(first.lesson_content.introduction || "");

        // Map topic_1 -> Level1, topic_2 -> Level2, topic_3 -> Level3
        const mapped: LevelItem[] = [
          {
            index: 1,
            title: `${first.lesson_name} — Part 1`,
            content: first.lesson_content.topic_1,
            gameType: first.game_type || "tiles",
            lessonLevel: first.lesson_level,
          },
          {
            index: 2,
            title: `${first.lesson_name} — Part 2`,
            content: first.lesson_content.topic_2,
            gameType: first.game_type || "fill-blanks",
            lessonLevel: first.lesson_level,
          },
          {
            index: 3,
            title: `${first.lesson_name} — Part 3`,
            content: first.lesson_content.topic_3,
            gameType: first.game_type || "fill-blanks",
            lessonLevel: first.lesson_level,
          },
        ];

        setLevels(mapped);
      } catch (err) {
        console.error(err);
        setMessage("Error fetching lessons.");
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, [topic]);

  if (loading) {
    return (
      <div className="page full-screen">
        <h2 className="title">Loading lessons...</h2>
      </div>
    );
  }

  return (
    <div className="page full-screen">
      <div className="orb orb1"></div>
      <div className="orb orb2"></div>

      <h1 className="title">{topic?.toUpperCase()}</h1>

      {introduction && (
        <div className="lesson-card" style={{ maxWidth: 900 }}>
          <h3 className="lesson-title">Introduction</h3>
          <p className="lesson-text">{introduction}</p>
        </div>
      )}

      <div className="levels-grid" style={{ marginTop: 20 }}>
        {levels.map((lvl) => (
          <LevelCard
            key={lvl.index}
            index={lvl.index}
            lesson={{
              lesson_name: lvl.title,
              lesson_content: {
                introduction: "",
                topic_1: lvl.content,
                topic_2: "",
                topic_3: "",
                conclusion: "",
              },
              lesson_level: lvl.lessonLevel || "Beginner",
            }}
            unlocked={true}
            gameType={lvl.gameType || "tiles"}
            topic={topic || ""}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: 24 }}>
        <button
          className="game-btn"
          onClick={() => {
            navigate("/");
          }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
