import StageTrack from './StageTrack.jsx';
import VideoDetail from './VideoDetail.jsx';
import { STAGES } from './stages.js';

// Presentational: one video as a title, progress and stage track; expands into the detail
export default function VideoRow({ video, stages, doneCount, isOpen, onToggleOpen, detail }) {
  const current = stages.find((stage) => stage.status === 'current');
  return (
    <li className={`video-row${isOpen ? ' video-row--open' : ''}`}>
      <button type="button" className="video-row__summary" aria-expanded={isOpen} onClick={onToggleOpen}>
        <span className="video-row__title">{video.title}</span>
        <span className="video-row__progress">
          {doneCount}/{STAGES.length}
        </span>
        <span className="video-row__current">{current ? `Siguiente: ${current.label}` : 'Todas las etapas completadas'}</span>
      </button>
      <StageTrack stages={stages} />
      {isOpen && <VideoDetail video={video} stages={stages} {...detail} />}
    </li>
  );
}
