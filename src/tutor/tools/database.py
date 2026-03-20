import json
import sqlite3
from crewai.tools.base_tool import BaseTool


class ReadDatabaseTool(BaseTool):
    name: str = "Read Database Tool"
    description: str = "Reads course content from the database based on a given topic."

    def _run(self, topic: str) -> str:
        lessons = get_lessons_by_topic(topic)
        if lessons:
            return json.dumps(lessons)
        return "No lessons found for the given topic."


def init_db():
    conn = sqlite3.connect('course_content.db')
    cursor = conn.cursor()
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL
        )
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            lesson_name TEXT NOT NULL,
            lesson_level TEXT NOT NULL,
            introduction TEXT,
            topic_1 TEXT,
            topic_2 TEXT,
            topic_3 TEXT,
            conclusion TEXT,
            game_type TEXT,
            game_data TEXT,
            evaluation_data TEXT,
            FOREIGN KEY (course_id) REFERENCES courses (id)
        )
        '''
    )

    # Handle migrations for columns that may not exist yet
    cursor.execute("PRAGMA table_info(lessons)")
    existing_columns = [column[1] for column in cursor.fetchall()]

    def add_column(column_name: str, column_def: str):
        if column_name not in existing_columns:
            try:
                cursor.execute(f'ALTER TABLE lessons ADD COLUMN {column_def}')
            except sqlite3.OperationalError as exc:
                print(f"Warning: Could not add {column_name} column: {exc}")

    add_column('game_type', 'game_type TEXT')
    add_column('game_data', 'game_data TEXT')
    add_column('evaluation_data', 'evaluation_data TEXT')

    conn.commit()
    conn.close()

def insert_course_data(topic: str, lessons: list) -> list[int]:
    """
    Inserts one or more lessons for a topic.
    Returns the list of lesson IDs that were inserted.
    """
    conn = sqlite3.connect('course_content.db')
    cursor = conn.cursor()
    inserted_ids: list[int] = []

    try:
        init_db()

        cursor.execute('SELECT id FROM courses WHERE LOWER(topic) = LOWER(?)', (topic,))
        result = cursor.fetchone()

        if result:
            course_id = result[0]
            if len(lessons) >= 3:
                cursor.execute('DELETE FROM lessons WHERE course_id = ?', (course_id,))
                print(f"Course '{topic}' already exists. Replacing with {len(lessons)} new lessons...")
            else:
                print(f"Course '{topic}' already exists. Appending {len(lessons)} lesson(s)...")
        else:
            cursor.execute('INSERT INTO courses (topic) VALUES (?)', (topic,))
            course_id = cursor.lastrowid
            print(f"Created new course '{topic}' with ID {course_id}")

        for lesson in lessons:
            lesson_content = lesson.get('lesson_content', {}) or {}
            cursor.execute(
                '''
                INSERT INTO lessons (
                    course_id, lesson_name, lesson_level,
                    introduction, topic_1, topic_2, topic_3, conclusion,
                    game_type, game_data, evaluation_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    course_id,
                    lesson.get('lesson_name', ''),
                    lesson.get('lesson_level', ''),
                    lesson_content.get('introduction'),
                    lesson_content.get('topic_1'),
                    lesson_content.get('topic_2'),
                    lesson_content.get('topic_3'),
                    lesson_content.get('conclusion'),
                    lesson.get('game_type'),
                    json.dumps(lesson.get('game_data')) if lesson.get('game_data') else None,
                    json.dumps(lesson.get('evaluation_data')) if lesson.get('evaluation_data') else None,
                )
            )
            inserted_ids.append(cursor.lastrowid)

        conn.commit()
        return inserted_ids
    except Exception as exc:
        conn.rollback()
        error_msg = f"Error adding lesson to database for topic '{topic}': {exc}"
        print(error_msg)
        raise Exception(error_msg) from exc
    finally:
        conn.close()

def get_all_courses_with_lessons():
    conn = sqlite3.connect('course_content.db')
    cursor = conn.cursor()

    try:
        init_db()

        cursor.execute('SELECT id, topic FROM courses')
        courses = cursor.fetchall()

        all_course_data = []
        for course_id, topic in courses:
            course_data = {'topic': topic, 'lessons': []}
            cursor.execute(
                '''
                SELECT id, lesson_name, lesson_level, introduction, topic_1, topic_2, topic_3, conclusion, game_type, game_data, evaluation_data
                FROM lessons
                WHERE course_id = ?
                ORDER BY id ASC
                ''',
                (course_id,)
            )
            lessons = cursor.fetchall()
            for row in lessons:
                (
                    lesson_id,
                    lesson_name,
                    lesson_level,
                    intro,
                    t1,
                    t2,
                    t3,
                    conc,
                    game_type,
                    game_data,
                    evaluation_data,
                ) = row
                lesson_content = {
                    'introduction': intro,
                    'topic_1': t1,
                    'topic_2': t2,
                    'topic_3': t3,
                    'conclusion': conc,
                }
                course_data['lessons'].append(
                    {
                        'id': lesson_id,
                        'lesson_name': lesson_name,
                        'lesson_level': lesson_level,
                        'lesson_content': lesson_content,
                        'game_type': game_type,
                        'game_data': json.loads(game_data) if game_data else None,
                        'evaluation_data': json.loads(evaluation_data) if evaluation_data else None,
                    }
                )

            all_course_data.append(course_data)

        conn.close()
        return all_course_data
    except Exception as exc:
        conn.close()
        print(f"Error fetching all courses with lessons: {exc}")
        return []

def get_all_course_topics():
    conn = sqlite3.connect('course_content.db')
    cursor = conn.cursor()
    try:
        init_db()
        cursor.execute('SELECT topic FROM courses')
        topics = [row[0] for row in cursor.fetchall()]
        conn.close()
        return topics
    except Exception as exc:
        conn.close()
        print(f"Error fetching all course topics: {exc}")
        return []

def get_lessons_by_topic(topic: str):
    conn = sqlite3.connect('course_content.db')
    cursor = conn.cursor()

    try:
        init_db()
        cursor.execute('SELECT id FROM courses WHERE LOWER(topic) = LOWER(?)', (topic,))
        course_id = cursor.fetchone()

        if not course_id:
            conn.close()
            return []
        course_id = course_id[0]

        cursor.execute(
            '''
            SELECT id, lesson_name, lesson_level, introduction, topic_1, topic_2, topic_3, conclusion, game_type, game_data, evaluation_data
            FROM lessons
            WHERE course_id = ?
            ORDER BY id ASC
            ''',
            (course_id,)
        )
        lessons_raw = cursor.fetchall()

        lessons_formatted = []
        for row in lessons_raw:
            (
                lesson_id,
                lesson_name,
                lesson_level,
                intro,
                t1,
                t2,
                t3,
                conc,
                game_type,
                game_data,
                evaluation_data,
            ) = row
            lesson_content = {
                'introduction': intro,
                'topic_1': t1,
                'topic_2': t2,
                'topic_3': t3,
                'conclusion': conc,
            }
            lessons_formatted.append(
                {
                    'id': lesson_id,
                    'lesson_name': lesson_name,
                    'lesson_level': lesson_level,
                    'lesson_content': lesson_content,
                    'game_type': game_type,
                    'game_data': json.loads(game_data) if game_data else None,
                    'evaluation_data': json.loads(evaluation_data) if evaluation_data else None,
                }
            )

        conn.close()
        return lessons_formatted
    except Exception as exc:
        conn.close()
        print(f"Error fetching lessons for topic '{topic}': {exc}")
        return []


def get_latest_lesson(topic: str, level: str):
    conn = sqlite3.connect('course_content.db')
    cursor = conn.cursor()
    try:
        init_db()
        cursor.execute('SELECT id FROM courses WHERE LOWER(topic) = LOWER(?)', (topic,))
        course = cursor.fetchone()
        if not course:
            conn.close()
            return None
        course_id = course[0]

        cursor.execute(
            '''
            SELECT id, lesson_name, lesson_level, game_type, game_data, evaluation_data
            FROM lessons
            WHERE course_id = ? AND lesson_level = ?
            ORDER BY id DESC
            LIMIT 1
            ''',
            (course_id, level)
        )
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        lesson_id, lesson_name, lesson_level, game_type, game_data, evaluation_data = row
        return {
            'id': lesson_id,
            'lesson_name': lesson_name,
            'lesson_level': lesson_level,
            'game_type': game_type,
            'game_data': json.loads(game_data) if game_data else None,
            'evaluation_data': json.loads(evaluation_data) if evaluation_data else None,
        }
    except Exception as exc:
        conn.close()
        print(f"Error fetching latest lesson for topic '{topic}': {exc}")
        return None


def update_lesson_game_data(lesson_id: int, game_type: str, game_data: dict, evaluation_data: dict | None = None):
    conn = sqlite3.connect('course_content.db')
    cursor = conn.cursor()
    try:
        cursor.execute(
            '''
            UPDATE lessons
            SET game_type = ?, game_data = ?, evaluation_data = ?
            WHERE id = ?
            ''',
            (
                game_type,
                json.dumps(game_data) if game_data else None,
                json.dumps(evaluation_data) if evaluation_data else None,
                lesson_id,
            )
        )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        print(f"Error updating game data for lesson {lesson_id}: {exc}")
        raise
    finally:
        conn.close()
