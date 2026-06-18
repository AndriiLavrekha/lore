"use client";

import { Plug, PlugZap, SearchX } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type ActivityEvent = {
  id: string;
  event: string;
  data: string;
  received: string;
};

type RequestState = { tone: "idle" | "success" | "error"; message: string };

const inputClass = "h-9 rounded-md border bg-background px-3 text-sm";

export function ActivityClient({ repoId }: { repoId: string }) {
  const [filter, setFilter] = useState("");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<RequestState>({
    tone: "idle",
    message: "Notification stream: configure LORE_WEB_NOTIFICATION_STREAM when needed.",
  });
  const sourceRef = useRef<EventSource | null>(null);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) =>
      `${event.event} ${event.data}`.toLowerCase().includes(needle),
    );
  }, [events, filter]);

  function disconnect() {
    sourceRef.current?.close();
    sourceRef.current = null;
    setConnected(false);
    setState({ tone: "success", message: "Reconnect state: idle" });
  }

  function connect() {
    disconnect();
    const source = new EventSource(`/api/repositories/${repoId}/events`);
    sourceRef.current = source;
    setConnected(true);
    setState({ tone: "success", message: "Reconnect state: connected" });

    source.onmessage = (message) => {
      setEvents((current) => [
        {
          id: `${Date.now()}:${current.length}`,
          event: message.type || "message",
          data: message.data,
          received: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 100));
    };

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
      setConnected(false);
      setState({
        tone: "error",
        message: "Notification stream unavailable. Check LORE_WEB_NOTIFICATION_STREAM and server support.",
      });
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 rounded-lg border bg-card/95 p-4 shadow-sm lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Event filter
          <input
            aria-label="Event filter"
            className={inputClass}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="branch.created"
          />
        </label>
        <Button type="button" onClick={connect} disabled={connected}>
          <PlugZap aria-hidden="true" />
          Connect stream
        </Button>
        <Button type="button" variant="outline" onClick={disconnect}>
          <Plug aria-hidden="true" />
          Disconnect
        </Button>
      </div>

      <div
        role="status"
        className={`rounded-md border px-3 py-2 text-sm ${
          state.tone === "error" ? "border-destructive/40 text-destructive" : "text-muted-foreground"
        }`}
      >
        {state.message}
      </div>

      <section>
        <h2 className="mb-2 text-base font-semibold">Timeline</h2>
        <div className="overflow-x-auto rounded-lg border bg-card/95 shadow-sm">
          <table className="w-full min-w-[780px] table-fixed text-left text-sm">
            <thead className="bg-muted text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Object</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length ? (
                filtered.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/45">
                    <td className="truncate px-4 py-3">{event.event}</td>
                    <td className="truncate px-4 py-3 font-mono text-xs">{event.data}</td>
                    <td className="truncate px-4 py-3">{event.received}</td>
                    <td className="px-4 py-3">{connected ? "streaming" : "cached"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                    <SearchX aria-hidden="true" className="mr-2 inline size-4" />
                    No events in the current timeline.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
