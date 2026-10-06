/**
 * The shell: a thin bar, and either the roadmap or one level.
 *
 * The runtime's state is exposed as a data attribute rather than a badge.
 * It matters when it *fails* — a working runtime announcing that it works
 * is noise — and the tests still need something to wait on. It boots on
 * the map too, so by the time a level is opened Python is usually ready.
 */
import { useRuntime } from "../runtime/shared";
import { LEVEL_ORDER, LEVEL_ORDER_V2 } from "../../content/roadmap";
import { goToMap, hashWithoutRoom, roomInHash, useRoute } from "./router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoom } from "../collab/useRoom";
import { SizeSyncContext } from "../collab/sizes";
import { SHOW_V1 } from "./versions";
import { Workbench } from "./Workbench";
import { Sandbox } from "./Sandbox";
import { RoadmapScreen } from "../roadmap/RoadmapScreen";
import { RoadmapV2Screen } from "../roadmap/RoadmapV2Screen";
import { SkillsScreen } from "../roadmap/SkillsScreen";
import { GlossaryScreen } from "../roadmap/GlossaryScreen";

export function App() {
  const route = useRoute();
  const boot = useRuntime();
  // One shared room for the page (`collab/`), up here so a level that
  // starts over (`gen`) keeps it.
  const roomView = useRoom();
  const room = roomView.room;
  const [gen, setGen] = useState(0);
  // A link's room is for one page: a lesson's level, or the sandbox. Opened
  // on another, go to its own.
  const roomLevel = room ? (room.lesson()?.level ?? "code") : null;
  const here = route.kind === "level" ? route.activity.id : route.kind;
  useEffect(() => {
    if (!room || !roomLevel || here === roomLevel) return;
    const keep = window.location.hash.slice(hashWithoutRoom().length);
    history.replaceState(null, "", `${location.pathname}${location.search}#/${roomLevel}${keep}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, [room, roomLevel, here]);
  // Joining from a link: the lesson is drawn with the room's seed, so it
  // waits for the room.
  const joining = roomInHash() !== null && !room && roomView.status !== "unreachable";
  const level = route.kind === "level" ? route.activity : null;

  // In a room, a gutter dragged here is dragged everywhere (`collab/sizes`).
  const sizeSync = useMemo(
    () => (room ? { share: room.shareSize.bind(room), listen: room.onSize.bind(room) } : null),
    [room],
  );

  /**
   * Full screen: the bar along the top goes, and the room's strip with it,
   * and the level is all there is. The browser is asked to go full screen
   * too; where it will not (an iPhone), the bar still goes. A tab in the
   * margin above the panes brings it back, and so does the browser's own
   * way out (Esc), which the page hears as `fullscreenchange`. Nothing is
   * stored: a reload is the ordinary page.
   */
  const [full, setFull] = useState(false);
  const canFull = level !== null || route.kind === "code";
  const browserFull = useRef(false);
  const enterFull = () => {
    setFull(true);
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => {
          browserFull.current = true;
        })
        .catch(() => {});
    }
  };
  const exitFull = () => {
    setFull(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && browserFull.current) {
        browserFull.current = false;
        setFull(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  // Leaving the level (the map has no full screen) leaves full screen.
  useEffect(() => {
    if (!canFull && full) exitFull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFull, full]);
  const fullButton = (
    <button
      type="button"
      className="to-map to-full"
      data-testid="full-screen"
      onClick={enterFull}
      aria-label="Full screen"
      title="Full screen"
    >
      <FullIcon />
      <span className="nav-word">Full screen</span>
    </button>
  );
  const number = level
    ? (level.version === 2 ? LEVEL_ORDER_V2 : LEVEL_ORDER).indexOf(level.id) + 1
    : 0;

  return (
    <div
      className="app"
      data-boot={boot.state}
      data-isolated={boot.state === "ready" && boot.isolated ? "yes" : "no"}
      data-route={route.kind}
      data-full={full ? "yes" : undefined}
    >
      {full && (
        <button
          type="button"
          className="exit-full"
          data-testid="exit-full-screen"
          onClick={exitFull}
          aria-label="Leave full screen"
          title="Leave full screen"
        />
      )}
      <header className="topbar">
        <h1>
          <a href={SHOW_V1 ? "#/map" : "#/"} className="brand">
            BotGineer
          </a>
        </h1>
        {/* Which version of the lessons the map shows. v1 is the game as
            it stands; v2 is being built beside it. */}
        {SHOW_V1 && (route.kind === "map" || route.kind === "map2") && (
          <nav className="versions" aria-label="Lesson version">
            <a
              href="#/map"
              className={route.kind === "map" ? "here" : ""}
              aria-current={route.kind === "map" ? "page" : undefined}
              data-testid="version-v1"
            >
              v1
            </a>
            <a
              href="#/v2"
              className={route.kind === "map2" ? "here" : ""}
              aria-current={route.kind === "map2" ? "page" : undefined}
              data-testid="version-v2"
            >
              v2
            </a>
          </nav>
        )}
        <span className="spacer" />

        {!level && (
          <nav className="whereabouts" aria-label="Screens">
            <a
              href={route.kind === "map2" ? "#/v2" : "#/map"}
              className={`to-map ${route.kind === "map" || route.kind === "map2" ? "here" : ""}`}
              aria-current={
                route.kind === "map" || route.kind === "map2"
                  ? "page"
                  : undefined
              }
              data-testid="nav-map"
              aria-label="Map"
            >
              <MapIcon />
              <span className="nav-word">Map</span>
            </a>
            <a
              href="#/code"
              className={`to-map ${route.kind === "code" ? "here" : ""}`}
              aria-current={route.kind === "code" ? "page" : undefined}
              data-testid="nav-sandbox"
              aria-label="Sandbox"
            >
              <CodeIcon />
              <span className="nav-word">Sandbox</span>
            </a>
            {(SHOW_V1 || route.kind !== "map2") && (
              <a
                href="#/skills"
                className={`to-map ${route.kind === "skills" ? "here" : ""}`}
                aria-current={route.kind === "skills" ? "page" : undefined}
                data-testid="nav-skills"
                aria-label="Skills"
              >
                <SkillsIcon />
                <span className="nav-word">Skills</span>
              </a>
            )}
            {(SHOW_V1 || route.kind !== "map2") && (
              <a
                href="#/glossary"
                className={`to-map ${route.kind === "glossary" ? "here" : ""}`}
                aria-current={route.kind === "glossary" ? "page" : undefined}
                data-testid="nav-glossary"
                aria-label="Glossary"
              >
                <BookIcon />
                <span className="nav-word">Glossary</span>
              </a>
            )}
            {route.kind === "code" && fullButton}
          </nav>
        )}

        {/* The way back to the path from inside a level, and where you are
            on it. The map is the progression now; the row of dots it
            replaced said how many levels there were and nothing else. */}
        {level && (
          <nav className="whereabouts" aria-label="Levels">
            <span className="whereabouts-level" data-testid="level-label">
              {number > 0 ? `Level ${number} · ` : ""}
              {level.title}
            </span>
            <button
              type="button"
              className="to-map"
              data-testid="to-map"
              onClick={() => goToMap(undefined, level.version)}
            >
              <MapIcon />
              Map
            </button>
            {fullButton}
          </nav>
        )}
      </header>

      {boot.state === "failed" && (
        <p className="alert" role="alert">
          The Python runtime did not start: {boot.message}
        </p>
      )}

      <SizeSyncContext.Provider value={sizeSync}>
      {/* Remounting per activity keeps each one's run state its own. */}
      {joining && (level || route.kind === "code") ? (
        <main className="joining" data-testid="room-joining">
          <p>Joining the room…</p>
        </main>
      ) : level ? (
        <Workbench
          key={`${level.id}:${gen}`}
          activity={level}
          roomView={roomView}
          onDiverged={() => setGen((n) => n + 1)}
        />
      ) : route.kind === "map2" ? (
        <RoadmapV2Screen />
      ) : route.kind === "code" ? (
        <Sandbox roomView={roomView} />
      ) : route.kind === "skills" ? (
        <SkillsScreen />
      ) : route.kind === "glossary" ? (
        <GlossaryScreen term={route.term} />
      ) : (
        <RoadmapScreen />
      )}
      </SizeSyncContext.Provider>
    </div>
  );
}

const SkillsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
    <path
      d="M5 19V13M12 19V8M19 19V4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
    <path
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const CodeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
    <path
      d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FullIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
    <path
      d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MapIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
    <path
      d="M9 4.5l-5 2v13l5-2 6 2 5-2v-13l-5 2-6-2zM9 4.5v13M15 6.5v13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);
