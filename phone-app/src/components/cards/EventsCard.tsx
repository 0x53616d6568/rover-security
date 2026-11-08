import type { RoverEvent } from "../../protocol/types";

interface EventsCardProps {
  events: RoverEvent[];
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function EventsCard({ events }: EventsCardProps) {
  return (
    <section className="card">
      <div className="card-title">
        <h3>Recent events</h3>
        <span className="meta">{events.length}</span>
      </div>
      {events.length === 0 ? (
        <p style={{ color: "var(--mut)", fontSize: 12 }}>No events yet.</p>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id}>
              <span className="time">{formatTime(event.time)}</span>
              <span className={`pill ${event.severity === "error" ? "error" : event.severity === "warn" ? "warn" : "info"}`}>
                {event.severity}
              </span>
              <span className="msg">{event.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
