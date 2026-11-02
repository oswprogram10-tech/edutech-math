/** 관심사 아이콘. 이모지만으로 정보를 전달하지 않도록 글자 라벨과 함께 쓴다. */
import type { Interest } from '../core/storage';

interface InterestIconProps {
  readonly interest: Interest;
}

export function InterestIcon({ interest }: InterestIconProps) {
  return (
    <svg
      className="interest-icon"
      viewBox="0 0 48 48"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {interest === 'baseball' ? (
        <>
          <circle cx="24" cy="24" r="17" />
          <path d="M13 12c6 5 8 13 7 23M35 12c-6 5-8 13-7 23" />
          <path d="M18 10l-2 3M30 10l2 3M18 38l-2-3M30 38l2-3" />
        </>
      ) : null}
      {interest === 'cooking' ? (
        <>
          <path d="M10 20h28v14a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5z" />
          <path d="M8 20h32M18 15c0-3 2-5 5-5M30 15c0-3-2-5-5-5" />
          <path d="M18 27h12" />
        </>
      ) : null}
      {interest === 'space' ? (
        <>
          <circle cx="24" cy="24" r="11" />
          <ellipse cx="24" cy="24" rx="20" ry="7" transform="rotate(-18 24 24)" />
          <path d="M24 13v22M13 24h22" />
        </>
      ) : null}
      {interest === 'game' ? (
        <>
          <rect x="8" y="15" width="32" height="19" rx="9" />
          <path d="M17 21v7M13.5 24.5h7" />
          <circle cx="31" cy="22" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="35" cy="27" r="1.8" fill="currentColor" stroke="none" />
        </>
      ) : null}
      {interest === 'animals' ? (
        <>
          <ellipse cx="24" cy="30" rx="9" ry="7" />
          <circle cx="13" cy="18" r="4" />
          <circle cx="22" cy="14" r="4" />
          <circle cx="32" cy="17" r="4" />
          <circle cx="36" cy="25" r="3.5" />
        </>
      ) : null}
      {interest === 'music' ? (
        <>
          <path d="M18 34V13l18-4v20" />
          <ellipse cx="14" cy="35" rx="5" ry="4" />
          <ellipse cx="32" cy="30" rx="5" ry="4" />
        </>
      ) : null}
    </svg>
  );
}
