import { useState } from 'react';

export default function Composer({ disabled, placeholder, onSend }) {
  const [text, setText] = useState('');

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    setText('');
    onSend(value);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="chat-composer">
      <textarea
        className="chat-composer__input"
        rows={2}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button type="button" className="chat-composer__send" disabled={disabled || !text.trim()} onClick={submit}>
        Send
      </button>
    </div>
  );
}
