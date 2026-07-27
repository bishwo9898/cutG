'use client';

import { useEffect, useState } from 'react';

export function HeroFlipWord({
  words,
  intervalMs = 2200,
}: {
  words: [string, string];
  intervalMs?: number;
}): React.ReactElement {
  const [index, setIndex] = useState(0);
  const longestWord = words.reduce((longest, word) => (word.length > longest.length ? word : longest));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, intervalMs);

    return (): void => window.clearInterval(timer);
  }, [intervalMs, words.length]);

  return (
    <span
      aria-label={words[index]}
      aria-live="polite"
      className="landing-cinematic-flip-word"
      data-active={index}
      role="text"
    >
      <span aria-hidden="true" className="landing-cinematic-flip-sizer">
        {longestWord}
      </span>

      {words.map((word, wordIndex) => (
        <span
          aria-hidden="true"
          className="landing-cinematic-flip-face"
          data-face={wordIndex}
          key={word}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
