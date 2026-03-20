import { Routes, Route } from "react-router-dom";
import TopicInput from "./pages/TopicInput";
import ContentPage from "./pages/ContentPage";
import LevelDetail from "./pages/LevelDetail";
import TileGame from "./pages/TileGame";
import FillInTheBlanks from "./pages/FillInTheBlanks";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TopicInput />} />
      <Route path="/content/:topic" element={<ContentPage />} />

      {/* Level Detail Page */}
      <Route path="/level/:topic/:levelIndex" element={<LevelDetail />} />

      {/* Game Routes */}
      <Route path="/game/:topic/tiles/:levelIndex" element={<TileGame />} />
      <Route path="/game/:topic/fill/:levelIndex" element={<FillInTheBlanks />} />
    </Routes>
  );
}
