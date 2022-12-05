import * as turf from "@turf/turf";
import { coverage } from "./data/coverage";
import merc from "mercator-projection";
import _ from "lodash";
import { countries } from "./data/countries";

export interface RoundState {
  pano: string;
  loc: turf.Position;
  guess?: {
    loc: turf.Position;
    time?: number;
  };
}


export function latLng2point(loc: google.maps.LatLngLiteral): turf.Position {
  return [loc.lng, loc.lat];
}

export function point2latlng(point: turf.Position): google.maps.LatLngLiteral {
  return { lat: point[1], lng: point[0] };
}

export function getRandomCoverageArea(
  polygon: turf.MultiPolygon | turf.Polygon
) {
  const frac = 256 / 1920;
  for (let i = 0; i < 10; i++) {
    const p = getRandomPointInPoly(polygon),
      xy = merc.fromLatLngToPoint(point2latlng(p)) as any;

    if (
      ctx?.getImageData(Math.floor(xy.x / frac), Math.floor(xy.y / frac), 1, 1)
        .data[0]
    ) {
      return p;
    }
  }
  throw "no point";
}

const canvas = document.createElement("canvas");
canvas.width = 1920;
canvas.height = 1920;
const ctx = canvas.getContext("2d");
var img = new Image();
img.onload = () => ctx!.drawImage(img, 0, 0);
img.src = coverage;

function getRandomPointInPoly(polygon: turf.MultiPolygon | turf.Polygon) {
  const bbox = turf.bbox(polygon);
  for (let i = 0; i < 1000; i++) {
    const pos = turf.randomPosition(bbox);
    if (turf.inside(pos, polygon)) return pos;
  }
  throw "faied";
}

export function randomRegionPoint(regions: turf.FeatureCollection<turf.Polygon>) {
  for (let i = 0; i < 100; i++) {
    try {
      const region = selectRegion(regions);
      console.log(i);
      return getRandomCoverageArea(region.geometry);
    } catch {}
  }
  throw "no region";
}


function selectRegion(regions: turf.FeatureCollection<turf.Polygon>) {
  const weights: number[] = [];

  let prev = 0;
  for (const region of regions.features) {
    prev +=
      region.properties!.dist ** 1 *
      turf.area(region) *
      (region.properties!.count || 1);
    weights.push(prev);
  }

  const sample = Math.random() * prev,
    index = weights.findIndex((w) => w > sample);

  return regions.features[index];
}


const countriesPoly = turf.multiPolygon(
  _.flatMap(
    countries.features.filter((c, i) => {
      return i < 10; //c.properties.name === "United States of America";
    }),
    (country) => {
      if (country.geometry.type === "MultiPolygon")
        return country.geometry.coordinates;
      else return [country.geometry.coordinates];
    }
  )
);

export async function createRound(
  regions?: turf.FeatureCollection<turf.Polygon>
): Promise<RoundState> {
  const root = !regions
    ? getRandomCoverageArea(countriesPoly.geometry)
    : randomRegionPoint(regions);

  console.log(root);
  for (let i = 0; i < 5; i++) {
    try {
      const panoRes = await findPano(root);
      return {
        pano: panoRes.loc.pano,
        loc: latLng2point(panoRes.loc.latLng!.toJSON()),
      };
    } catch {}
  }
  await new Promise((res) => setTimeout(res, 1000));
  return createRound(regions);
}

async function findPano(loc: turf.Position) {
  const sv = new google.maps.StreetViewService();
  let rad;
  for (rad = 1; rad < 2 ** 10; rad *= 2) {
    try {
      const pano = await sv.getPanorama({
        location: point2latlng(loc),
        preference: google.maps.StreetViewPreference.NEAREST,
        source: google.maps.StreetViewSource.OUTDOOR,
        radius: rad * 1000,
      });
      if (
        pano.data.tiles.worldSize.width > 5000 &&
        pano.data.copyright?.includes("Google")
      )
        return { loc: pano.data.location!, rad };
    } catch {}
  }

  throw "could not find pano";
}

export function findRegions(rounds: RoundState[]) {
  const completed = _.takeRight(rounds, 1000).filter((r) => r.guess?.time);

  const centroids: turf.Feature<turf.Point>[] = [];

  if (completed.length > 0) {
    const clusters = turf.clustersDbscan(
      turf.featureCollection(
        completed.map((r) =>
          turf.point(r.loc, { dist: turf.distance(r.loc, r.guess!.loc) })
        )
      ),
      100,
      { units: "kilometers", minPoints: 1 }
    );

    turf.clusterEach(clusters, "cluster", (c) => {
      if (c) {
        const centroid = turf.center(c).geometry.coordinates; //c.features[0].properties.centroid;
        const avgDist = _.meanBy(c.features, (f) => f.properties.dist);
        if (centroid)
          centroids.push(
            turf.point(centroid, { dist: avgDist, count: c.features.length })
          );
      }
    });
  }

  const points = _.range(5).map((i) =>
    turf.point([-180 + (i / 4) * 360, 0], { dist: 40000, count: 0 })
  );

  const all = [...points, ...centroids];

  const centroidsColl = turf.featureCollection(all);
  const voronoi = turf.voronoi(centroidsColl, { bbox: [-180, -90, 180, 90] });

  voronoi.features = _.compact(
    voronoi.features.map((feature, i) => {
      return {
        ...feature,
        //geometry: turf.intersect(feature, countriesPoly)?.geometry as any,
        properties: all[i].properties,
      };
    })
  );

  return voronoi;
}