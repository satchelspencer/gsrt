import React, { useEffect, useState, useRef } from "react";
import { latLng2point, point2latlng, RoundState } from "./util";
import * as turf from "@turf/turf";
import interpolate from "color-interpolate";
import _ from "lodash";

export interface RoundProps {
  value: RoundState;
  onChange: (round: RoundState) => void;
  regions?: turf.FeatureCollection<turf.Polygon>;
}

export function Round(props: RoundProps) {
  const mapEl = useRef<HTMLDivElement>(null),
    panoEl = useRef<HTMLDivElement>(null),
    guessMarker = useRef<google.maps.Marker>(),
    locMarker = useRef<google.maps.Marker>(),
    line = useRef<google.maps.Polyline>(),
    pano = useRef<google.maps.StreetViewPanorama>(),
    map = useRef<google.maps.Map>();

  const [expanded, setExpanded] = useState(false),
    [active, setActive] = useState(false);

  /* init map and pano */
  useEffect(() => {
    if (!mapEl.current || !panoEl.current) return;

    map.current = new google.maps.Map(mapEl.current, {
      center: { lat: 0, lng: 0 },
      zoom: 1,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      draggableCursor: "crosshair",
      controlSize: 20,
    });

    guessMarker.current = new google.maps.Marker({
      map: map.current,
      icon: { ...marker, fillColor: "black" },
    });

    locMarker.current = new google.maps.Marker({
      map: map.current,
      icon: { ...marker, fillColor: "green" },
    });

    line.current = new google.maps.Polyline({
      map: map.current,
      path: [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0 },
      ],
      strokeColor: "black",
      strokeWeight: 1,
      strokeOpacity: 0,
    });

    pano.current = new google.maps.StreetViewPanorama(panoEl.current, {
      pov: { heading: 90, pitch: 0 },
      disableDefaultUI: true,
      showRoadLabels: false,
      linksControl: false,
      clickToGo: false,
    });
  }, []);

  /* click on map to set guess */
  useEffect(() => {
    if (!map.current || props.value.guess?.time) return;
    const listener = map.current.addListener("click", (e) => {
      props.onChange({
        ...props.value,
        guess: { loc: latLng2point(e.latLng.toJSON()) },
      });
    });
    return () => google.maps.event.removeListener(listener);
  }, [props.value.guess?.time]);

  /* init and reset pano */
  useEffect(() => {
    pano.current?.setPano(props.value.pano);
    pano.current?.setZoom(0);
    pano.current?.setPov({ heading: 90, pitch: 0 });
    map.current?.setZoom(1);
    map.current?.setCenter({ lat: 0, lng: 0 });
    setExpanded(false);
    setActive(false);
    setTimeout(() => setActive(true), 700);
  }, [props.value.pano]);

  /* show/hide guess, location and line */
  useEffect(() => {
    if (props.value.guess) {
      guessMarker.current?.setPosition(point2latlng(props.value.guess.loc));
      guessMarker.current?.setOpacity(0.5);
    } else {
      guessMarker.current?.setOpacity(0);
      guessMarker.current?.setPosition({ lat: 0, lng: 0 });
    }

    if (props.value.guess?.time && props.value.guess) {
      locMarker.current?.setPosition(point2latlng(props.value.loc));
      locMarker.current?.setOpacity(0.5);
      line.current?.setOptions({
        path: [
          point2latlng(props.value.loc),
          point2latlng(props.value.guess.loc),
        ],
        strokeOpacity: 0.5,
      });
    } else {
      locMarker.current?.setOpacity(0);
      locMarker.current?.setPosition({ lat: 0, lng: 0 });
      line.current?.setOptions({
        strokeOpacity: 0,
      });
    }
  }, [props.value.guess]);

  /* draw regions when not guessing */
  const polys = useRef<google.maps.Polygon[]>([]);
  useEffect(() => {
    if (!props.regions || !map.current || !props.value.guess?.time) return;

    const usedFeatures = props.regions.features.filter(
        (c) => c.properties?.count
      ),
      minDist =
        _.minBy(usedFeatures, (c) => c.properties?.dist ?? Infinity)?.properties
          ?.dist ?? 1,
      maxDist =
        _.maxBy(usedFeatures, (c) => c.properties?.dist ?? Infinity)?.properties
          ?.dist ?? 40000;

    for (const cell of props.regions.features) {
      const dist = cell.properties?.dist;

      for (const line of cell.geometry.coordinates) {
        const scale = (dist - minDist) / (maxDist + 1e-5 - minDist);
        const poly = new google.maps.Polygon({
          map: map.current,
          paths: [
            (cell.geometry.type === "Polygon" ? line : line[0]).map((c) =>
              point2latlng(c)
            ),
          ],
          strokeColor: "black",
          strokeWeight: 1,
          zIndex: -1,
          strokeOpacity: cell.properties?.count ? 0.1 : 0.05,
          fillColor: cell.properties?.count
            ? interp(scale ** (1 / 4))
            : "white",
          fillOpacity: 0.2,
        });
        polys.current.push(poly);
      }
    }
    return () => {
      polys.current.forEach((p) => p.setMap(null));
      polys.current = [];
    };
  }, [props.regions, map.current, !props.value.guess?.time]);

  return (
    <div style={{ width: "100%", height: "100%", position: "absolute" }}>
      <div
        style={{ width: "100%", height: "100%", position: "absolute" }}
        ref={panoEl}
        onClick={() => setExpanded(false)}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        <div
          onMouseEnter={() => active && setExpanded(true)}
          onClick={() => setExpanded(true)}
          style={{
            borderTopLeftRadius: 10,
            width: expanded ? 1000 : 500,
            height: expanded ? 500 : 300,
            maxWidth: "100%",
            maxHeight: "100%",
            transition: "0.2s all",
            opacity: expanded ? 1 : 0.5,
          }}
          ref={mapEl}
        />
      </div>
    </div>
  );
}

const marker = {
  path: 0,
  fillColor: "red",
  strokeWeight: 0,
  fillOpacity: 1,
  scale: 7,
};

const interp = interpolate(["green", "yellow", "red"]);
