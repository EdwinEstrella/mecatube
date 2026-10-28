// Presentational: renders prompt options when the illustrator chat asks a next-step question
export default function NextStepButtons({ step, canSend, onSend }) {
  if (!step) return null;
  return (
    <div className="next-step">
      <p className="next-step__question">{step.question}</p>
      <div className="next-step__options">
        {step.options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            className={`settings__button ${index === 0 ? 'settings__button--primary' : 'settings__button--ghost'}`}
            disabled={!canSend}
            onClick={() => onSend(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
