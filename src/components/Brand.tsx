/** The app name beside the mint paw mark (design-system README, Iconography). */
export function Brand() {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <ellipse cx="6.2" cy="11" rx="2" ry="2.6" />
          <ellipse cx="10.2" cy="6.6" rx="2" ry="2.6" />
          <ellipse cx="15" cy="6.6" rx="2" ry="2.6" />
          <ellipse cx="18.6" cy="11" rx="2" ry="2.6" />
          <path d="M12.4 11.4c2.6 0 5.2 2.9 5.2 5.4 0 1.8-1.5 2.7-3 2.4-.8-.2-1.4-.5-2.2-.5s-1.4.3-2.2.5c-1.5.3-3-.6-3-2.4 0-2.5 2.6-5.4 5.2-5.4z" />
        </svg>
      </span>
      <h1 className="title">PawLog</h1>
    </div>
  );
}
