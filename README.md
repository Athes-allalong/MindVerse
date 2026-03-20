# 📚 Tutor Crew – AI-Powered Course Generator

Tutor Crew is a multi-agent AI system built using crewAI and FastAPI. It allows you to generate structured courses dynamically using AI agents that collaborate to create lessons, organize content, and serve it via an API.

---

## 🚀 Features

- 🤖 Multi-agent AI collaboration using crewAI  
- 📖 Automatic course and lesson generation  
- ⚡ FastAPI backend for API access  
- 🌐 Easy frontend integration (React supported)  
- 🔧 Fully customizable agents and tasks  

---

## 🛠️ Tech Stack

- Python (>=3.10, <3.14)  
- crewAI  
- FastAPI  
- Uvicorn  
- UV (dependency manager)  

---

## 📦 Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <your-project-folder>
```

---

### 2. Install UV (Dependency Manager)

```bash
pip install uv
```

---

### 3. Create & Activate Virtual Environment

```bash
uv venv
```

**Activate environment:**

- Windows (PowerShell):
```bash
.\.venv\Scripts\Activate.ps1
```

- macOS/Linux:
```bash
source .venv/bin/activate
```

---

### 4. Install Dependencies

```bash
uv pip install -e .
```

---

### 5. Setup Environment Variables

Create a `.env` file in the project root:

```env
OPENAI_API_KEY="your_openai_api_key_here"
```

---

## ▶️ Running the Backend

Start the FastAPI server:

```bash
uv run uvicorn tutor.src.tutor.api:app --reload --host 0.0.0.0 --port 8000
```

- API will be available at:  
  http://localhost:8000  
- Auto-reload enabled for development  

---

## 🔌 API Endpoints

### 1. Generate Course

**POST** `/generate-course`

```json
{
  "topic": "Programming in Python"
}
```

---

### 2. Get All Courses

**GET** `/courses`

Returns list of available course topics.

---

### 3. Get Lessons for a Course

**GET** `/courses/{topic}/lessons`

Example:
```
/courses/Web%20Development%20with%20React/lessons
```

---

## 🎯 Frontend Integration (React)

You can easily connect a React frontend to this backend.

### Quick Setup (Using Vite)

```bash
npm create vite@latest frontend-tutor-app -- --template react
cd frontend-tutor-app
npm install
npm run dev
```

Frontend runs at:
http://localhost:5173

---

### How It Works

1. User submits a topic → `/generate-course`  
2. Fetch available courses → `/courses`  
3. Load lessons → `/courses/{topic}/lessons`  
4. Display lessons step-by-step  

---

## ⚙️ Customization

You can modify the system easily:

- `config/agents.yaml` → Define AI agents  
- `config/tasks.yaml` → Define workflows  
- `crew.py` → Core logic and tools  
- `main.py` → Input handling  

---

## 🧠 How It Works

Tutor Crew uses multiple AI agents with defined roles:

- Each agent has a goal and specialization  
- Tasks are distributed among agents  
- Agents collaborate to generate structured lessons  

This enables intelligent, modular, and scalable course creation.

---

## 🆘 Support & Resources

- Docs: https://docs.crewai.com  
- Discord: https://discord.com/invite/X4JWnZnxPb  
- GitHub: https://github.com/joaomdmoura/crewai  

---

## ✨ Contributing

Contributions are welcome!  
Feel free to fork the repo and submit a pull request.

---
