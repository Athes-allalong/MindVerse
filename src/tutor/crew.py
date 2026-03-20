from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai import LLM
from typing import List
from pydantic import BaseModel
from tutor.src.tutor.tools.custom_tool import WriteToDatabaseTool, WriteGameDataTool
from tutor.src.tutor.tools.database import ReadDatabaseTool
from dotenv import load_dotenv
import os

load_dotenv()


class Lesson_Content(BaseModel):
    introduction: str
    topic_1: str
    topic_2: str
    topic_3: str
    conclusion: str


class Lesson(BaseModel):
    lesson_name: str
    lesson_content: Lesson_Content
    lesson_level: str
    game_type: str | None = None

class Tiles_Game(BaseModel):
    question:str
    tiles:List[str]
    answers:List[str]

class Fill_in_the_blanks_Game(BaseModel):
    sentence:str
    blanks:List[str]
    answers:List[str]

class Puzzle_blocks_Game(BaseModel):
    blocks:List[str]
    correct_order:List[str]

class Evaluation(BaseModel):
    summary:str
    next_level:bool

@CrewBase
class Tutor():
    """Tutor crew"""
    llm = LLM(model="gemini/gemini-2.5-pro")
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    # --------------------------
    #        AGENTS
    # --------------------------

    @agent
    def teacher(self) -> Agent:
        return Agent(
            config=self.agents_config['teacher'],
            llm=self.llm,
            verbose=True,
            tools=[WriteToDatabaseTool()]
        )

    @agent
    def game_generator(self) -> Agent:
        return Agent(
            config=self.agents_config['game_generator'],
            llm=self.llm,
            verbose=True,
            tools=[ReadDatabaseTool(), WriteGameDataTool()]
        )

    @agent
    def evaluator(self) -> Agent:
        return Agent(
            config=self.agents_config['evaluator'],
            llm=self.llm,
            verbose=True
        )

    # --------------------------
    #          TASKS
    # --------------------------

    @task
    def tutor_task(self) -> Task:
        return Task(
            config=self.tasks_config['tutor_task'],
            expected_output="""
STRICT REQUIREMENT:
Return ONLY VALID JSON. No markdown (no ```), no explanation, no text outside JSON.

FORMAT EXACTLY:

{
  "lessons": [
    {
      "lesson_name": "string",
      "lesson_level": "Beginner" | "Intermediate" | "Advanced",
      "lesson_content": {
        "introduction": "string",
        "topic_1": "string",
        "topic_2": "string",
        "topic_3": "string",
        "conclusion": "string"
      }
    }
  ]
}

Each topic must have 2–4 sentences.  
Each lesson MUST be stored using WriteToDatabaseTool exactly in this JSON structure.
"""
        )

    @task
    def game_generation_task(self) -> Task:
        return Task(
            config=self.tasks_config['game_generation_task']
        )

    @task
    def evaluator_task(self) -> Task:
        return Task(
            config=self.tasks_config['evaluator_task'],
            expected_output="""
Return STRICT JSON ONLY in this format:
{
  "lesson_name": "string",
  "lesson_level": "string",
  "game_type": "tiles" | "fill_in_the_blanks" | "puzzle",
  "evaluation_summary": "string (why the answer would be correct/incorrect)",
  "answer_key": {
    // echo the canonical answers/correct order for quick evaluation
  }
}
"""
        )

    # --------------------------
    #         CREW
    # --------------------------

    @crew
    def crew(self) -> Crew:
        """Creates the Tutor crew"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
