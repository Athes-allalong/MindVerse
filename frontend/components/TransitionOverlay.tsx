import "../styles.css";

export default function TransitionOverlay() {
  return (
    <div className="transition-overlay">
      <div className="train">
        <div className="engine">🚂</div>
        <div className="car">◆</div>
        <div className="car">◆</div>
        <div className="car">◆</div>
      </div>
      <div className="transition-text">Entering Game World...</div>
    </div>
  );
}
