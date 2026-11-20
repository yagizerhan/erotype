// SPDX-License-Identifier: AGPL-3.0-or-later
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizeWord } from "../../shared/text";
import { soundEngine } from "../typing/sound";

export type CaretStyle = "line" | "block" | "underline";
export type FontSizeOption = "sm" | "md" | "lg";

interface TypingAreaProps {
  words: string[];
  wordIndex: number;
  currentInput: string;
  typedWords?: string[];
  disabled?: boolean;
  blurred?: boolean;
  blindMode?: boolean;
  fontSize?: FontSizeOption;
  quickRestartTab?: boolean;
  caretStyle: CaretStyle;
  onInputChange: (nextVal: string, isKeyError: boolean) => void;
  onBackToPreviousWord?: (clearWord: boolean) => void;
  onTabToRestart?: () => void;
  onQuickRestart?: () => void;
}

export const TypingArea: React.FC<TypingAreaProps> = ({
  words,
  wordIndex,
  currentInput,
  typedWords,
  disabled = false,
  blurred = false,
  blindMode = false,
  fontSize = "md",
  quickRestartTab = false,
  caretStyle,
  onInputChange,
  onBackToPreviousWord,
  onTabToRestart,
  onQuickRestart
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [focused, setFocused] = useState(true);
  const [caretPos, setCaretPos] = useState<{ x: number; y: number; h: number; w: number }>({
    x: 0,
    y: 0,
    h: 30,
    w: 14
  });
  const [lineOffsetPx, setLineOffsetPx] = useState(0);

  const focusTyping = () => {
    if (!disabled) {
      hiddenInputRef.current?.focus({ preventScroll: true });
      setFocused(true);
    }
  };

  useEffect(() => {
    if (!disabled) {
      focusTyping();
    }
  }, [disabled, words]);

  // Global keydown listener: if user presses any printable key while unfocused
  // (and not typing into the username input), automatically focus the typing area!
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" && document.activeElement !== hiddenInputRef.current) {
        return; // typing in username input
      }
      if (
        document.activeElement !== hiddenInputRef.current &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        hiddenInputRef.current?.focus({ preventScroll: true });
        setFocused(true);
      }
    };

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [disabled]);

  // Calculate smooth caret position and auto-scroll lines
  useLayoutEffect(() => {
    wordRefs.current.length = words.length;
    const container = containerRef.current;
    const activeWordEl = wordRefs.current[wordIndex];
    if (!container || !activeWordEl) {
      if (wordIndex === 0) {
        setLineOffsetPx(0);
        setCaretPos({ x: 0, y: 0, h: 30, w: 14 });
      }
      return;
    }

    const charSpans = activeWordEl.querySelectorAll<HTMLSpanElement>("span.char");
    const charIdx = currentInput.length;

    let targetX = activeWordEl.offsetLeft;
    const targetY = activeWordEl.offsetTop;
    let charW = 14;
    const charH = activeWordEl.offsetHeight || 32;

    if (charSpans.length > 0) {
      if (charIdx < charSpans.length) {
        const ch = charSpans[charIdx];
        targetX = activeWordEl.offsetLeft + ch.offsetLeft;
        charW = ch.offsetWidth || 14;
      } else {
        const lastCh = charSpans[charSpans.length - 1];
        targetX = activeWordEl.offsetLeft + lastCh.offsetLeft + lastCh.offsetWidth;
        charW = lastCh.offsetWidth || 14;
      }
    }

    setCaretPos({ x: targetX, y: targetY, h: charH, w: charW });

    const rowHeight = fontSize === "lg" ? 56 : fontSize === "sm" ? 42 : 48;
    const currentRow = Math.floor(targetY / rowHeight);
    if (currentRow >= 2) {
      setLineOffsetPx((currentRow - 1) * rowHeight);
    } else {
      setLineOffsetPx(0);
    }
  }, [wordIndex, currentInput, words, fontSize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      if (quickRestartTab && onQuickRestart) {
        onQuickRestart();
      } else {
        onTabToRestart?.();
      }
      return;
    }

    if (
      e.key === "Backspace" &&
      currentInput.length === 0 &&
      wordIndex > 0 &&
      onBackToPreviousWord
    ) {
      e.preventDefault();
      soundEngine.playKey("backspace");
      onBackToPreviousWord(e.ctrlKey || e.metaKey || e.altKey);
      return;
    }

    if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "Home" ||
      e.key === "End"
    ) {
      e.preventDefault();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const nextVal = e.target.value;
    const targetWord = words[wordIndex] ?? "";

    if (nextVal === " ") {
      return;
    }

    if (!nextVal.endsWith(" ") && nextVal.length > targetWord.length + 8) {
      soundEngine.playError();
      return;
    }

    const isSpace = nextVal.endsWith(" ");
    const isDeletion = nextVal.length < currentInput.length;
    const cleanCandidate = normalizeWord(isSpace ? nextVal.slice(0, -1) : nextVal);

    let isKeyError = false;
    if (!isDeletion) {
      if (isSpace) {
        if (cleanCandidate === targetWord) {
          soundEngine.playKey("space");
        } else {
          isKeyError = true;
          if (blindMode) soundEngine.playKey("space");
          else soundEngine.playError();
        }
      } else {
        const expectedPrefix = targetWord.slice(0, cleanCandidate.length);
        if (cleanCandidate === expectedPrefix) {
          soundEngine.playKey("press");
        } else {
          isKeyError = true;
          if (blindMode) soundEngine.playKey("press");
          else soundEngine.playError();
        }
      }
    } else {
      soundEngine.playKey("backspace");
    }

    onInputChange(nextVal, isKeyError);
  };

  return (
    <div
      className={`typing-stage ${focused ? "is-focused" : "is-unfocused"} ${
        blurred ? "is-blurred" : ""
      }`}
      onMouseDown={(e) => {
        e.preventDefault();
        focusTyping();
      }}
    >
      <input
        ref={hiddenInputRef}
        type="text"
        className="hidden-typing-input"
        value={currentInput}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={(e) => e.preventDefault()}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      <div className={`words-viewport font-${fontSize}`}>
        <div
          ref={containerRef}
          className={`words-flow font-${fontSize}`}
          style={{ transform: `translateY(-${lineOffsetPx}px)` }}
        >
          {focused && !disabled && !blurred && words.length > 0 && (
            <div
              className={`caret caret-${caretStyle} ${
                currentInput.length === 0 && wordIndex === 0 ? "caret-blink" : ""
              }`}
              style={{
                transform: `translate3d(${caretPos.x}px, ${caretPos.y}px, 0)`,
                height: caretStyle === "underline" ? "2px" : `${caretPos.h - 4}px`,
                width: caretStyle === "line" ? "2px" : `${caretPos.w}px`,
                marginTop: caretStyle === "underline" ? `${caretPos.h - 4}px` : "2px"
              }}
            />
          )}

          {words.map((word, wIdx) => {
            const isPast = wIdx < wordIndex;
            const isActive = wIdx === wordIndex;
            const chars = Array.from(word);

            const pastTypedStr =
              isPast && typedWords && typedWords[wIdx] !== undefined
                ? typedWords[wIdx]
                : word;
            const typedChars = isActive
              ? Array.from(normalizeWord(currentInput))
              : isPast
              ? Array.from(normalizeWord(pastTypedStr))
              : [];

            const extraChars =
              (isActive || isPast) && typedChars.length > chars.length
                ? typedChars.slice(chars.length)
                : [];

            const hasPastError =
              isPast && !blindMode && normalizeWord(pastTypedStr) !== word;

            return (
              <span
                key={wIdx}
                ref={(el) => {
                  wordRefs.current[wIdx] = el;
                }}
                className={`w-token ${hasPastError ? "w-has-error" : ""}`}
              >
                {chars.map((ch, cIdx) => {
                  let charClass = "char";
                  if (isPast) {
                    if (blindMode) {
                      charClass += " c-correct";
                    } else if (cIdx < typedChars.length) {
                      charClass +=
                        typedChars[cIdx] === ch ? " c-correct" : " c-wrong";
                    } else {
                      charClass += " c-missed";
                    }
                  } else if (isActive && cIdx < typedChars.length) {
                    if (blindMode) {
                      charClass += " c-correct";
                    } else {
                      charClass +=
                        typedChars[cIdx] === ch ? " c-correct" : " c-wrong";
                    }
                  }
                  return (
                    <span key={cIdx} className={charClass}>
                      {ch}
                    </span>
                  );
                })}
                {!blindMode &&
                  extraChars.map((extraCh, eIdx) => (
                    <span key={`extra-${eIdx}`} className="char c-extra">
                      {extraCh}
                    </span>
                  ))}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
