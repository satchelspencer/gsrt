import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";

import _ from "lodash";
import { createRound, findRegions, RoundState } from "./util";
import { Round } from "./round";

const loader = new Loader({
  apiKey: process.env.MAPS_KEY!,
  version: "weekly",
  libraries: [],
});

export function Root() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    loader.load().then(() => setLoaded(true));
  }, []);
  return loaded ? <App /> : null;
}

function App() {
  const [rounds, setRounds] = useState<RoundState[]>([]),
    [index, setIndex] = useState(-1),
    round: RoundState | undefined = rounds[index],
    regions = useMemo(() => findRegions(rounds), [round?.guess?.time ?? 0]),
    [loading, setLoading] = useState(false);

  /* load and dave rounds in localstorage */
  useEffect(() => {
    try {
      const rounds = JSON.parse(localStorage.getItem("rounds")!) ?? [];
      setRounds(rounds);
      setIndex(rounds.length - 1);
      if(!rounds.length) createNewRound()
    } catch {}
  }, []);
  useEffect(() => saveRounds(rounds), [rounds]);

  const createNewRound = useCallback(async () => {
    setLoading(true);
    try {
      const round = await createRound(regions),
        newRounds = [...rounds, round];
      setRounds(newRounds);
      setIndex(newRounds.length - 1);
    } catch {}
    setLoading(false);
  }, [regions, rounds]);

  useEffect(() => {
    const listner = (e: KeyboardEvent) => {
      if (loading) return;
      else if (e.key === "Backspace") {
        const nr = [...rounds];
        nr.splice(index, 1);
        setRounds(nr);
        setIndex(nr.length - 1);
        createNewRound();
      } else if (e.key === " ") {
        if (!round?.guess) return;
        else if (round.guess.time) createNewRound();
        else {
          const nr = [...rounds],
            guessed: RoundState = {
              ...round,
              guess: { ...round.guess, time: new Date().getTime() },
            };
          nr[index] = guessed;
          setRounds(nr);
        }
      } else if (e.key === "d")
        download(JSON.stringify(rounds), "text/json", "history.json");
    };
    window.addEventListener("keydown", listner);

    return () => window.removeEventListener("keydown", listner);
  }, [regions, rounds, index, loading, round]);

  return (
    <div style={{ ...fill }}>
      {round ? (
        <Round
          value={round}
          onChange={(r) => {
            const nr = [...rounds];
            nr[index] = r;
            setRounds(nr);
          }}
          regions={regions}
        />
      ) : null}
      <div
        style={{
          ...fill,
          background: "black",
          opacity: loading ? 0.7 : 0,
          pointerEvents: loading ? "all" : "none",
          zIndex: 1000,
        }}
      />
    </div>
  );
}

const saveRounds = _.debounce((s: RoundState[]) => {
  localStorage.setItem("rounds", JSON.stringify(s));
}, 1000);

function download(contents: string, type: string, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contents], { type }));
  a.download = name;
  a.click();
}

const fill: React.CSSProperties = {
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  position: "absolute",
};
