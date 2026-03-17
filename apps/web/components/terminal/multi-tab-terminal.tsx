"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent, NewTabButton } from "@/components/ui/tabs";
import { XtermTerminal } from "@/components/terminal/xterm-terminal";
import { terminalCache } from "@/lib/terminal";

export interface TerminalSession {
  id: string;
  title: string;
}

interface MultiTabTerminalProps {
  className?: string;
  webSocketUrl?: string;
}

export function MultiTabTerminal({
  className = "",
  webSocketUrl = "ws://localhost:3002",
}: MultiTabTerminalProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([
    { id: "terminal-1", title: "Terminal 1" },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("terminal-1");
  const sessionCounterRef = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize cache on mount
  useEffect(() => {
    // Pre-create the first terminal
    terminalCache.getOrCreate("terminal-1");
  }, []);

  // Handle window resize - only fit the active terminal
  useEffect(() => {
    const handleResize = () => {
      terminalCache.fitActive();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const createNewSession = useCallback(() => {
    const newId = `terminal-${++sessionCounterRef.current}`;
    const newSession: TerminalSession = {
      id: newId,
      title: `Terminal ${sessionCounterRef.current}`,
    };
    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newId);

    // Pre-create terminal in cache
    terminalCache.getOrCreate(newId);
  }, []);

  const closeSession = useCallback(
    (sessionId: string) => {
      // Don't allow closing the last session
      if (sessions.length <= 1) {
        return;
      }

      setSessions((prev) => {
        const newSessions = prev.filter((s) => s.id !== sessionId);

        // If we closed the active session, switch to another one
        if (sessionId === activeSessionId) {
          const index = prev.findIndex((s) => s.id === sessionId);
          const newActiveIndex = Math.min(index, newSessions.length - 1);
          const newActiveId = newSessions[newActiveIndex]?.id || newSessions[0]?.id;
          setActiveSessionId(newActiveId);
        }

        // Remove from cache
        terminalCache.remove(sessionId);

        return newSessions;
      });
    },
    [sessions, activeSessionId]
  );

  // Handle active session change (switch tabs)
  const handleSessionChange = useCallback((newSessionId: string) => {
    setActiveSessionId(newSessionId);

    // Mark old session as inactive
    if (activeSessionId) {
      terminalCache.setInactive(activeSessionId);
    }

    // Mark new session as active and fit it
    terminalCache.setActive(newSessionId);
  }, [activeSessionId]);

  return (
    <div className={`h-full w-full flex flex-col ${className}`}>
      <Tabs value={activeSessionId} onValueChange={handleSessionChange}>
        <TabsList className="w-full justify-start rounded-none border-b bg-muted/50">
          {sessions.map((session) => (
            <TabsTrigger
              key={session.id}
              value={session.id}
              closable={sessions.length > 1}
              onClose={() => closeSession(session.id)}
              className="data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              {session.title}
            </TabsTrigger>
          ))}
          <NewTabButton onClick={createNewSession} />
        </TabsList>

        {/* Single terminal container - content switches based on active tab */}
        <div ref={containerRef} className="flex-1 h-full overflow-hidden">
          {activeSessionId && (
            <XtermTerminal
              key={activeSessionId}
              cacheKey={activeSessionId}
              isActive={true}
              webSocketMode={true}
              webSocketUrl={webSocketUrl}
              className="h-full w-full"
            />
          )}
        </div>
      </Tabs>
    </div>
  );
}

export default MultiTabTerminal;
