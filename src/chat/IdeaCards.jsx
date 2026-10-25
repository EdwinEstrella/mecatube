import HeartIcon from './HeartIcon.jsx';

// Presentational list of idea cards. The container decides what is saved, chosen and choosable.
export default function IdeaCards({ ideas, savedNumbers, chosenNumber, canChoose, onChoose, onToggleSave }) {
  return (
    <ol className="idea-cards">
      {ideas.map((idea) => {
        const isSaved = savedNumbers.has(idea.number);
        const isChosen = chosenNumber === idea.number;
        return (
          <li key={idea.number} className={`idea-card${isChosen ? ' idea-card--chosen' : ''}`}>
            <div className="idea-card__header">
              <span className="idea-card__number">{idea.number}</span>
              <h3 className="idea-card__title">{idea.title}</h3>
              {idea.format && <span className="idea-card__badge">{idea.format}</span>}
              {isChosen && <span className="idea-card__badge idea-card__badge--chosen">Chosen</span>}
              <button
                type="button"
                className={`idea-card__heart${isSaved ? ' idea-card__heart--on' : ''}`}
                aria-label={isSaved ? `Remove idea ${idea.number} from favorites` : `Save idea ${idea.number} to favorites`}
                aria-pressed={isSaved}
                onClick={() => onToggleSave(idea)}
              >
                <HeartIcon filled={isSaved} />
              </button>
              <button
                type="button"
                className="idea-card__choose"
                disabled={!canChoose}
                aria-label={`Choose idea ${idea.number}`}
                onClick={() => onChoose(idea.number)}
              >
                Choose
              </button>
            </div>
            {idea.question && <p className="idea-card__question">{idea.question}</p>}
            <dl className="idea-card__meta">
              {idea.thumbnailText && (
                <div>
                  <dt>Thumbnail</dt>
                  <dd>{idea.thumbnailText}</dd>
                </div>
              )}
              {idea.trigger && (
                <div>
                  <dt>Trigger</dt>
                  <dd>{idea.trigger}</dd>
                </div>
              )}
            </dl>
          </li>
        );
      })}
    </ol>
  );
}
