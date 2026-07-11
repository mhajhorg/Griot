"use client";

import type { ChatSession } from "@/lib/useSessionHistory";

interface HistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (session: ChatSession) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  /** Controls visibility on mobile only — desktop always shows the sidebar regardless. */
  isOpen: boolean;
  onClose: () => void;
}

function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function HistorySidebar({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onNew,
  isOpen,
  onClose,
}: HistorySidebarProps) {
  function handleSelect(session: ChatSession) {
    onSelect(session);
    onClose(); // no-op visually on desktop, closes the drawer on mobile
  }

  function handleNew() {
    onNew();
    onClose();
  }

  return (
    <>
      {/* Backdrop — mobile only, closes the drawer on tap */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          flex flex-col w-64 sm:w-60 shrink-0 border-r border-border bg-card
          fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          sm:static sm:translate-x-0 sm:z-auto sm:h-full
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-border">
          <span className="font-heading text-sm font-semibold text-foreground">
            Sessions
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNew}
              title="New session"
              className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-accent hover:bg-secondary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {/* Close button — mobile only */}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="sm:hidden flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="font-body text-xs text-muted-foreground">
                No sessions yet.
              </p>
              <p className="font-body text-xs text-muted-foreground mt-1">
                Start a conversation and it&apos;ll appear here.
              </p>
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  className={`group flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                    isActive
                      ? "bg-accent/10 border-l-2 border-accent"
                      : "hover:bg-secondary border-l-2 border-transparent"
                  }`}
                  onClick={() => handleSelect(session)}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-body text-xs truncate ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {session.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="font-body text-[10px] text-muted-foreground/70">
                        {relativeDate(session.updatedAt)}
                      </p>
                      {session.totalSpent > 0 && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <p className="font-mono text-[10px] text-accent/70">
                            ${session.totalSpent.toFixed(3)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(session.id);
                    }}
                    title="Delete session"
                    className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-destructive transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
