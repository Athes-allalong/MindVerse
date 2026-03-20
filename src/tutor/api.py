import os
import sys
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from fastapi.middleware.cors import CORSMiddleware
import traceback
from urllib.parse import unquote

from tutor.src.tutor.crew import Tutor
from tutor.src.tutor.tools.database import (
    init_db,
    get_all_course_topics,
    get_lessons_by_topic,
    get_latest_lesson,
    update_lesson_game_data,
)
from crewai import Agent, Task, Crew, Process, LLM
from tutor.src.tutor.tools.custom_tool import WriteToDatabaseTool, WriteGameDataTool, WriteEvaluationDataTool
from tutor.src.tutor.tools.database import ReadDatabaseTool
import json

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------  MODELS  -----------------

class GenerateCourseRequest(BaseModel):
    topic: str

class CourseSummary(BaseModel):
    topic: str

class LessonContent(BaseModel):
    introduction: str
    topic_1: str
    topic_2: str
    topic_3: str
    conclusion: str

class Lesson(BaseModel):
    lesson_name: str
    lesson_content: LessonContent
    lesson_level: str
    game_type: str | None = None
    game_data: Dict[str, Any] | None = None
    evaluation_data: Dict[str, Any] | None = None


class EvaluationRequest(BaseModel):
    game_type: str | None = None  # Optional - backend will use stored type from database
    user_submission: Dict[str, Any]


def _run_submission_evaluation(
    topic: str,
    level: str,
    lesson_name: str,
    game_type: str,
    game_data: Dict[str, Any],
    evaluation_data: Dict[str, Any] | None,
    user_submission: Dict[str, Any],
):
    """
    Invoke an evaluator agent to score a player's submission.
    """
    llm = LLM(model="gemini/gemini-2.5-flash")

    evaluator_agent = Agent(
        role="Educational Game Evaluator",
        goal="Judge player submissions for educational mini-games and explain the result.",
        backstory=(
            "You receive the official game data and the player's submission. "
            "Compare the submission to the correct answers and explain whether it is correct."
        ),
        verbose=True,
        llm=llm,
    )

    game_data_json = json.dumps(game_data, ensure_ascii=False, indent=2)
    evaluation_json = (
        json.dumps(evaluation_data, ensure_ascii=False, indent=2)
        if evaluation_data
        else "null"
    )
    submission_json = json.dumps(user_submission, ensure_ascii=False, indent=2)

    evaluation_task = Task(
        description=(
            "Evaluate the player's submission for an educational game.\n\n"
            f"Topic: {topic}\n"
            f"Lesson: {lesson_name}\n"
            f"Level: {level}\n"
            f"Game type: {game_type}\n\n"
            "Official game data JSON:\n"
            f"{game_data_json}\n\n"
            "Reference evaluation data (may be null):\n"
            f"{evaluation_json}\n\n"
            "Player submission JSON:\n"
            f"{submission_json}\n\n"
            "Compare the player's submission with the official answers.\n"
            "- For tile games: Compare selected_tiles with the answers array.\n"
            "- For fill-in-the-blanks: Compare the answers array with the correct answers.\n"
            "- For puzzle games: Compare ordered_blocks with correct_order array (order matters).\n\n"
            "If the submission is fully correct, is_correct must be true. "
            "Otherwise set is_correct to false. "
            "Explain the reasoning in feedback."
        ),
        expected_output="""
Return STRICT JSON ONLY in this format:
{
  "is_correct": true | false,
  "feedback": "Concise explanation of correctness.",
  "expected_answers": {
    "answers": [...],
    "correct_order": [...]
  }
}
""",
        agent=evaluator_agent,
    )

    evaluation_crew = Crew(
        agents=[evaluator_agent],
        tasks=[evaluation_task],
        process=Process.sequential,
        verbose=True,
    )

    raw_result = evaluation_crew.kickoff()

    if isinstance(raw_result, dict):
        return raw_result

    try:
        return json.loads(str(raw_result))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Evaluator returned invalid JSON: {exc}",
        ) from exc


# -----------------  STARTUP  -----------------

@app.on_event("startup")
async def startup_event():
    init_db()


# -----------------  FIXED ENDPOINT  -----------------

@app.post("/generate-course")
async def generate_course(request: GenerateCourseRequest):
    """
    Trigger course generation for the topic.
    IMPORTANT:
    Do NOT return raw LLM output. Return only a clean message.
    Frontend does NOT use lesson content here.
    """
    try:
        inputs = {"topic": request.topic.strip()}

        # Start the full crew run (teacher + game generator)
        Tutor().crew().kickoff(inputs=inputs)

        # *** FIX: return clean response only ***
        return {
            "status": "success",
            "message": f"Course generation started for '{request.topic}'.",
            "topic": request.topic
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error during course generation: {e}"
        )


# -----------------  GET ALL COURSES  -----------------

@app.get("/courses", response_model=List[CourseSummary])
async def get_courses():
    try:
        topics = get_all_course_topics()
        return [{"topic": topic} for topic in topics]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error while fetching courses: {e}")


# -----------------  GENERATE SINGLE LESSON  -----------------

@app.post("/generate-lesson/{topic}/{level}")
async def generate_single_lesson(topic: str, level: str):
    """
    Generate a single lesson with the following flow:
    1. Teacher agent generates lesson content and saves it
    2. Game generator agent reads the lesson and generates game content, then saves it
    3. Evaluator agent prepares evaluation criteria based on game content
    """
    try:
        decoded_topic = unquote(topic)
        level = level.capitalize()

        if level not in ["Beginner", "Intermediate", "Advanced"]:
            raise HTTPException(status_code=400, detail="Invalid level")

        llm = LLM(model="gemini/gemini-2.5-flash")
        
        # Step 1: Teacher Agent - Generate lesson content
        teacher_agent = Agent(
            role="Educational Content Creator",
            goal=f"Create a comprehensive {level} level lesson on {decoded_topic}",
            backstory="Expert educator generating structured lessons.",
            verbose=True,
            tools=[WriteToDatabaseTool()],
            llm=llm
        )

        lesson_task = Task(
            description=f"""
            Create a detailed {level} lesson on {decoded_topic}.
            Use EXACT JSON:
            {{
              "lesson_name": "string",
              "lesson_content": {{
                "introduction": "string",
                "topic_1": "string",
                "topic_2": "string",
                "topic_3": "string",
                "conclusion": "string"
              }},
              "lesson_level": "{level}"
            }}
            Save immediately using WriteToDatabaseTool with topic="{decoded_topic}".
            """,
            expected_output=f"A structured {level} lesson saved to the database.",
            agent=teacher_agent
        )

        # Step 2: Game Generator Agent - Generate game content
        game_generator_agent = Agent(
            role=f"{decoded_topic} Game Content creator",
            goal=f"""
            Pick a game idea from: Puzzle blocks, Drag and Drop tiles, Fill in the blanks.
            Generate the content for the game based on the lesson content for {decoded_topic} at {level} level.
            """,
            backstory="""
            You are a game developer who needs to choose between the following games:
            - Drag and Drop tiles: Generate a question, and the tiles with one-phrase answers.
            - Fill in the blanks: Generate a question with blanks and one-phrase answers.
            - Puzzle blocks: Generate a chronology of events as puzzle blocks.
            """,
            verbose=True,
            tools=[ReadDatabaseTool(), WriteGameDataTool()],
            llm=llm
        )

        game_generation_task = Task(
            description=f"""
            First, use the Read Database Tool to retrieve the lesson content for topic="{decoded_topic}" and level="{level}".
            
            Then, pick a game idea from: Puzzle blocks, Fill in the blanks, Drag and Drop tiles.
            
            Generate the game content based on the lesson. The output must be in the format:
            
            - Drag and Drop tiles:
              {{
                "question": "string",
                "tiles": ["string", "string", "string"],
                "answers": ["string", "string", "string"]
              }}
            
            - Fill in the blanks:
              {{
                "sentence": "string with <BLANK_1>, <BLANK_2> placeholders",
                "blanks": ["<BLANK_1>", "<BLANK_2>"],
                "answers": ["string", "string"]
              }}
            
            - Puzzle blocks:
              {{
                "blocks": ["string", "string", "string"],
                "correct_order": ["string", "string", "string"]
              }}
            
            After generating the game content, use Write Game Data Tool to save it:
            - topic="{decoded_topic}"
            - level="{level}"
            - game_type="tiles" OR "fill_in_the_blanks" OR "puzzle" (based on your choice)
            - game_data=JSON string of the game content you generated
            """,
            expected_output=f"Game content for {level} level lesson saved to database.",
            agent=game_generator_agent,
            context=[lesson_task]  # Game generator needs access to lesson task output
        )

        # Step 3: Evaluator Agent - Prepare evaluation criteria
        evaluator_agent = Agent(
            role="Evaluator",
            goal=f"Prepare evaluation criteria for the game content generated for {decoded_topic} at {level} level.",
            backstory="""
            You are an expert evaluator who prepares evaluation criteria for game content.
            You will receive the game content and prepare answer keys and evaluation guidelines.
            """,
            verbose=True,
            tools=[ReadDatabaseTool(), WriteEvaluationDataTool()],
            llm=llm
        )

        evaluator_task = Task(
            description=f"""
            First, retrieve the game content that was generated for topic="{decoded_topic}" and level="{level}".
            You can use the Read Database Tool or refer to the game_generation_task output.
            
            Review the game content and prepare evaluation criteria in this format:
            {{
              "answer_key": {{
                // Echo the correct answers/order from the game content
                // For tiles: {{"answers": ["answer1", "answer2", ...]}}
                // For fill_in_the_blanks: {{"answers": ["answer1", "answer2", ...]}}
                // For puzzle: {{"correct_order": ["block1", "block2", ...]}}
              }},
              "evaluation_guidelines": "string (guidelines for evaluating user answers - explain what makes an answer correct or incorrect)"
            }}
            
            After preparing the evaluation criteria, use Write Evaluation Data Tool to save it:
            - topic="{decoded_topic}"
            - level="{level}"
            - evaluation_data=JSON string of the evaluation criteria you prepared
            """,
            expected_output="Evaluation criteria prepared and saved for the game content.",
            agent=evaluator_agent,
            context=[game_generation_task]  # Evaluator needs access to game generation task output
        )

        # Create crew with all three agents in sequence
        crew = Crew(
            agents=[teacher_agent, game_generator_agent, evaluator_agent],
            tasks=[lesson_task, game_generation_task, evaluator_task],
            process=Process.sequential,
            verbose=True
        )

        # Run the crew
        crew.kickoff(inputs={"topic": decoded_topic, "level": level})

        # Retrieve the updated lesson with game data
        lesson = get_latest_lesson(decoded_topic, level)
        if lesson:
            # Get full lesson data including content
            lessons = get_lessons_by_topic(decoded_topic)
            level_lessons = [l for l in lessons if l.get("lesson_level") == level]
            if level_lessons:
                latest_lesson = level_lessons[-1]
                # Merge game data from get_latest_lesson
                if lesson.get('game_data'):
                    latest_lesson['game_data'] = lesson['game_data']
                if lesson.get('game_type'):
                    latest_lesson['game_type'] = lesson['game_type']
                return latest_lesson

        raise HTTPException(status_code=500, detail="Lesson saved but not found")

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {e}")


# -----------------  GET LESSON BY LEVEL  -----------------

@app.get("/courses/{topic}/lessons/{level}", response_model=Lesson)
async def get_course_lesson_by_level(topic: str, level: str):
    try:
        decoded_topic = unquote(topic)
        level = level.capitalize()
        lessons = get_lessons_by_topic(decoded_topic)
        level_lessons = [l for l in lessons if l.get('lesson_level') == level]
        if not level_lessons:
            raise HTTPException(status_code=404, detail=f"No {level} lesson found")
        return level_lessons[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching lesson: {e}")


# -----------------  GET ALL LESSONS FOR TOPIC  -----------------

@app.get("/courses/{topic}/lessons", response_model=List[Lesson])
async def get_course_lessons(topic: str):
    try:
        decoded_topic = unquote(topic)
        lessons = get_lessons_by_topic(decoded_topic)
        if not lessons:
            raise HTTPException(status_code=404, detail=f"No lessons found for topic: {decoded_topic}")
        return lessons
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching lessons: {e}")


# -----------------  EVALUATE GAME SUBMISSION  -----------------

@app.post("/evaluate/{topic}/{level}")
async def evaluate_game_submission(topic: str, level: str, payload: EvaluationRequest):
    try:
        decoded_topic = unquote(topic)
        level = level.capitalize()

        lesson = get_latest_lesson(decoded_topic, level)
        if not lesson:
            raise HTTPException(status_code=404, detail=f"No lesson found for topic {decoded_topic} at level {level}")

        game_type = lesson.get("game_type")
        game_data = lesson.get("game_data")
        evaluation_data = lesson.get("evaluation_data")

        if not game_type or not game_data:
            raise HTTPException(status_code=400, detail="Game data not available yet. Please try again later.")

        # Always use the stored game_type from the database, ignore what frontend sends
        # This ensures consistency and prevents routing mismatches
        evaluation_result = _run_submission_evaluation(
            topic=decoded_topic,
            level=level,
            lesson_name=lesson.get("lesson_name", "Lesson"),
            game_type=game_type,
            game_data=game_data,
            evaluation_data=evaluation_data,
            user_submission=payload.user_submission,
        )

        return evaluation_result
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error evaluating submission: {e}")
