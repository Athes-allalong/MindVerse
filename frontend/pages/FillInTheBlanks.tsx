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

interface FillBlanksGameData {
  sentence: string;
  blanks: string[];
  answers: string[];
}

interface Lesson {
  lesson_name: string;
  lesson_level: string;
  lesson_content: LessonContent;
  game_type?: string;
  game_data?: FillBlanksGameData;
}

const LEVEL_LABELS = ["", "Beginner", "Intermediate", "Advanced"];

export default function FillInTheBlanks() {
  const { topic, levelIndex } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [gameData, setGameData] = useState<FillBlanksGameData | null>(null);
  const [content, setContent] = useState<string>("");
  const [displayText, setDisplayText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [blanks, setBlanks] = useState<string[]>([]);
  const [inputs, setInputs] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Enable scroll
  useEffect(() => {
    document.body.style.overflowY = "auto";
    return () => {
      document.body.style.overflowY = "hidden";
    };
  }, []);

  // Process content into blanks
  const generateBlanks = (text: string) => {
    const words = text.split(" ");
    const keyWords = words.filter((w) => w.length > 5).slice(0, 5);

    let tempText = text;
    keyWords.forEach((w, idx) => {
      tempText = tempText.replace(w, `____${idx + 1}____`);
    });

    setBlanks(keyWords);
    setInputs(new Array(keyWords.length).fill(""));
    setDisplayText(tempText);
  };

  useEffect(() => {
    const fetchLesson = async () => {
      if (!topic || !levelIndex) return;
      const idx = parseInt(levelIndex, 10);
      const levelName = LEVEL_LABELS[idx] || "Beginner";

      try {
        setLoading(true);

        const res = await fetch(
          `${API_BASE_URL}/courses/${encodeURIComponent(topic)}/lessons/${levelName}`
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({} as any));
          throw new Error(errData.detail || "Failed to fetch lesson.");
        }

        const data = await res.json();
        
        // PRIMARY CHECK: Use game_data structure (most reliable indicator)
        const gameData = data.game_data || {};
        const actualGameType = (data.game_type || '').toLowerCase();
        
        console.log("FillInTheBlanks: Game type from lesson:", actualGameType);
        console.log("FillInTheBlanks: Game data keys:", Object.keys(gameData));
        
        // If game_data has tiles and question, it's a tile game - REDIRECT
        if (gameData.tiles && gameData.question) {
          console.log("FillInTheBlanks: WRONG PAGE - Detected tile game structure, redirecting...");
          navigate(`/game/${encodeURIComponent(topic!)}/tiles/${levelIndex}`, { replace: true });
          return;
        }
        
        // If game_data has sentence and blanks, it's fill-in-the-blanks - STAY HERE
        if (gameData.sentence && gameData.blanks) {
          console.log("FillInTheBlanks: CORRECT PAGE - Fill-in-the-blanks detected");
          setLesson(data);
          
          const gd = gameData as FillBlanksGameData;
          setGameData(gd);
          setDisplayText(gd.sentence || "");
          
          // Determine number of blanks needed
          let numBlanks = 0;
          let blankLabels: string[] = [];
          
          if (gd.answers && gd.answers.length > 0) {
            numBlanks = gd.answers.length;
          } else if (gd.blanks && gd.blanks.length > 0) {
            numBlanks = gd.blanks.length;
            blankLabels = gd.blanks;
          } else if (gd.sentence) {
            const placeholderRegex = /<BLANK_\d+>/g;
            const matches = gd.sentence.match(placeholderRegex);
            if (matches) {
              numBlanks = matches.length;
              blankLabels = [...new Set(matches)];
            }
          }
          
          if (blankLabels.length === 0 && numBlanks > 0) {
            blankLabels = Array.from({ length: numBlanks }, (_, i) => `Blank ${i + 1}`);
          }
          
          if (numBlanks === 0 && gd.sentence) {
            numBlanks = 1;
            blankLabels = ["Blank 1"];
          }
          
          setBlanks(blankLabels);
          setInputs(new Array(numBlanks).fill(""));
          return;
        }
        
        // FALLBACK: Check game_type string
        if (actualGameType.includes('tile') || actualGameType.includes('drag') || actualGameType.includes('drop')) {
          console.log("FillInTheBlanks: WRONG PAGE - game_type indicates tile game, redirecting...");
          navigate(`/game/${encodeURIComponent(topic!)}/tiles/${levelIndex}`, { replace: true });
          return;
        }
        
        // Default: assume fill-in-the-blanks
        console.log("FillInTheBlanks: Assuming fill-in-the-blanks (default)");
        setLesson(data);

        if (data.game_data) {
          const gd = data.game_data as FillBlanksGameData;
          setGameData(gd);
          setDisplayText(gd.sentence || "");
          
          // Determine number of blanks needed
          let numBlanks = 0;
          let blankLabels: string[] = [];
          
          if (gd.answers && gd.answers.length > 0) {
            // Use number of answers as the definitive count
            numBlanks = gd.answers.length;
          } else if (gd.blanks && gd.blanks.length > 0) {
            numBlanks = gd.blanks.length;
            blankLabels = gd.blanks;
          } else if (gd.sentence) {
            // Extract placeholders like <BLANK_1>, <BLANK_2>, etc.
            const placeholderRegex = /<BLANK_\d+>/g;
            const matches = gd.sentence.match(placeholderRegex);
            if (matches) {
              numBlanks = matches.length;
              blankLabels = [...new Set(matches)]; // Remove duplicates
            }
          }
          
          // If we still don't have labels, create them
          if (blankLabels.length === 0 && numBlanks > 0) {
            blankLabels = Array.from({ length: numBlanks }, (_, i) => `Blank ${i + 1}`);
          }
          
          // Ensure we have at least one blank if we have a sentence
          if (numBlanks === 0 && gd.sentence) {
            numBlanks = 1;
            blankLabels = ["Blank 1"];
          }
          
          setBlanks(blankLabels);
          setInputs(new Array(numBlanks).fill(""));
        } else {
          const combinedText = [
            data.lesson_content.introduction,
            data.lesson_content.topic_1,
            data.lesson_content.topic_2,
            data.lesson_content.topic_3,
            data.lesson_content.conclusion,
          ]
            .filter(Boolean)
            .join(" ");
          setContent(combinedText);
        }
      } catch (err) {
        console.error("Error fetching lesson:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [topic, levelIndex]);

  useEffect(() => {
    if (content && !gameData) {
      generateBlanks(content);
    }
  }, [content, gameData]);

  const levelName = useMemo(() => {
    if (!levelIndex) return "Beginner";
    const idx = parseInt(levelIndex, 10);
    return LEVEL_LABELS[idx] || "Beginner";
  }, [levelIndex]);

  if (loading) {
    return (
      <div className="page scroll-page">
        <h2 className="title">Loading Game...</h2>
      </div>
    );
  }

  const updateInput = (i: number, val: string) => {
    const copy = [...inputs];
    copy[i] = val;
    setInputs(copy);
  };

  const handleSubmitAnswers = async () => {
    if (!topic || !levelName || !lesson) return;
    setSubmitting(true);
    setFeedback("");
    try {
      // Don't send game_type - backend will use the stored type from database
      const res = await fetch(
        `${API_BASE_URL}/evaluate/${encodeURIComponent(topic)}/${levelName}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_submission: {
              answers: inputs,
            },
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
      console.error("Error evaluating answers:", err);
      setFeedback(
        err instanceof Error ? err.message : "Unable to evaluate answers right now."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page scroll-page">
      <h1 className="title">
        Fill in the Blanks — {lesson?.lesson_level || `Level ${levelIndex}`}
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

      <div className="lesson-card" style={{ maxWidth: 900 }}>
        <p className="lesson-text">{displayText}</p>
      </div>

      <div className="blanks-container" style={{ maxWidth: 900, margin: "auto" }}>
        {blanks.map((label, i) => (
          <div key={label || i} className="lesson-card" style={{ marginTop: 20 }}>
            <p>{label || `Blank ${i + 1}`}</p>
            <input
              value={inputs[i] || ""}
              onChange={(e) => updateInput(i, e.target.value)}
              placeholder="Enter the missing word"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                marginTop: "10px",
              }}
            />
          </div>
        ))}

        <button
          className="game-btn"
          style={{ marginTop: 30 }}
          onClick={handleSubmitAnswers}
          disabled={submitting}
        >
          {submitting ? "Evaluating..." : "Submit Answers"}
        </button>

        {feedback && (
          <p className="lesson-text" style={{ marginTop: 15 }}>
            {feedback}
          </p>
        )}
      </div>
    </div>
  );
}
