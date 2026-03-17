export function TerminalEmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        {/* Terminal Icon */}
        <div className="flex justify-center mb-4">
          <svg
            className="w-16 h-16 text-[#8b949e]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Main text */}
        <div className="text-base font-medium text-[#8b949e] mb-2">
          Please select a workspace first
        </div>

        {/* Secondary text */}
        <div className="text-sm text-[#6e7681]">
          Click a workspace in the list to open the terminal
        </div>
      </div>
    </div>
  );
}
