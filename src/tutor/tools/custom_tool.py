from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field

import os
from tutor.src.tutor.tools.database import insert_course_data, get_latest_lesson, update_lesson_game_data
import json

class WriteFileInput(BaseModel):
    """Input for WriteFileTool."""
    file_path: str = Field(..., description="Path to the file to write.")
    content: str = Field(..., description="Content to write to the file.")

class WriteFileTool(BaseTool):
    name: str = "Write File Tool"
    description: str = (
        "A tool that can write content to a specified file."
    )
    args_schema: Type[BaseModel] = WriteFileInput

    def _run(self, file_path: str, content: str) -> str:
        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w') as f:
                f.write(content)
            return f"File successfully written to {file_path}"
        except Exception as e:
            return f"Error writing file {file_path}: {e}"

class WriteToDatabaseInput(BaseModel):
    """Input for WriteToDatabaseTool."""
    topic: str = Field(..., description="The topic of the course.")
    lesson: str = Field(..., description="The JSON string representation of a Lesson object.")

class WriteToDatabaseTool(BaseTool):
    name: str = "Write To Database Tool"
    description: str = (
        "A tool that can write a single lesson to the SQLite database."
    )
    args_schema: Type[BaseModel] = WriteToDatabaseInput

    def _run(self, topic: str, lesson: str) -> str:
        try:
            lesson_data = json.loads(lesson)
            print(f"[WriteToDatabaseTool] Attempting to save lesson for topic '{topic}'")
            print(f"[WriteToDatabaseTool] Lesson data: {lesson_data.get('lesson_name', 'Unknown')} - Level: {lesson_data.get('lesson_level', 'Unknown')}")
            insert_course_data(topic, [lesson_data])
            print(f"[WriteToDatabaseTool] Successfully saved lesson '{lesson_data.get('lesson_name', 'Unknown')}' for topic '{topic}'")
            return f"Lesson '{lesson_data.get('lesson_name', 'Unknown')}' for topic '{topic}' successfully added to database."
        except json.JSONDecodeError as e:
            error_msg = f"Error parsing lesson JSON for topic '{topic}': {e}"
            print(f"[WriteToDatabaseTool] {error_msg}")
            return error_msg
        except Exception as e:
            error_msg = f"Error adding lesson to database for topic '{topic}': {e}"
            print(f"[WriteToDatabaseTool] {error_msg}")
            import traceback
            traceback.print_exc()
            return error_msg

class WriteGameDataInput(BaseModel):
    """Input for WriteGameDataTool."""
    topic: str = Field(..., description="The topic of the course.")
    level: str = Field(..., description="The lesson level (Beginner, Intermediate, Advanced).")
    game_type: str = Field(..., description="The type of game (tiles, fill_in_the_blanks, puzzle).")
    game_data: str = Field(..., description="The JSON string representation of the game data.")

class WriteGameDataTool(BaseTool):
    name: str = "Write Game Data Tool"
    description: str = (
        "A tool that can write game data for a lesson to the SQLite database. "
        "Use this after generating game content for a lesson."
    )
    args_schema: Type[BaseModel] = WriteGameDataInput

    def _run(self, topic: str, level: str, game_type: str, game_data: str) -> str:
        try:
            # Get the latest lesson for this topic and level
            lesson = get_latest_lesson(topic, level)
            if not lesson:
                error_msg = f"No lesson found for topic '{topic}' at level '{level}'"
                print(f"[WriteGameDataTool] {error_msg}")
                return error_msg

            lesson_id = lesson['id']
            game_data_dict = json.loads(game_data)
            
            print(f"[WriteGameDataTool] Updating game data for lesson ID {lesson_id}")
            print(f"[WriteGameDataTool] Game type: {game_type}, Topic: {topic}, Level: {level}")
            
            update_lesson_game_data(lesson_id, game_type, game_data_dict)
            
            print(f"[WriteGameDataTool] Successfully saved game data for lesson ID {lesson_id}")
            return f"Game data for '{topic}' level '{level}' successfully saved to database."
        except json.JSONDecodeError as e:
            error_msg = f"Error parsing game data JSON for topic '{topic}': {e}"
            print(f"[WriteGameDataTool] {error_msg}")
            return error_msg
        except Exception as e:
            error_msg = f"Error saving game data for topic '{topic}': {e}"
            print(f"[WriteGameDataTool] {error_msg}")
            import traceback
            traceback.print_exc()
            return error_msg

class WriteEvaluationDataInput(BaseModel):
    """Input for WriteEvaluationDataTool."""
    topic: str = Field(..., description="The topic of the course.")
    level: str = Field(..., description="The lesson level (Beginner, Intermediate, Advanced).")
    evaluation_data: str = Field(..., description="The JSON string representation of the evaluation data.")

class WriteEvaluationDataTool(BaseTool):
    name: str = "Write Evaluation Data Tool"
    description: str = (
        "A tool that can write evaluation data for a lesson to the SQLite database. "
        "Use this after preparing evaluation criteria for game content."
    )
    args_schema: Type[BaseModel] = WriteEvaluationDataInput

    def _run(self, topic: str, level: str, evaluation_data: str) -> str:
        try:
            # Get the latest lesson for this topic and level
            lesson = get_latest_lesson(topic, level)
            if not lesson:
                error_msg = f"No lesson found for topic '{topic}' at level '{level}'"
                print(f"[WriteEvaluationDataTool] {error_msg}")
                return error_msg

            lesson_id = lesson['id']
            game_type = lesson.get('game_type', 'tiles')
            game_data = lesson.get('game_data', {})
            evaluation_data_dict = json.loads(evaluation_data)
            
            print(f"[WriteEvaluationDataTool] Updating evaluation data for lesson ID {lesson_id}")
            print(f"[WriteEvaluationDataTool] Topic: {topic}, Level: {level}")
            
            update_lesson_game_data(lesson_id, game_type, game_data, evaluation_data_dict)
            
            print(f"[WriteEvaluationDataTool] Successfully saved evaluation data for lesson ID {lesson_id}")
            return f"Evaluation data for '{topic}' level '{level}' successfully saved to database."
        except json.JSONDecodeError as e:
            error_msg = f"Error parsing evaluation data JSON for topic '{topic}': {e}"
            print(f"[WriteEvaluationDataTool] {error_msg}")
            return error_msg
        except Exception as e:
            error_msg = f"Error saving evaluation data for topic '{topic}': {e}"
            print(f"[WriteEvaluationDataTool] {error_msg}")
            import traceback
            traceback.print_exc()
            return error_msg
