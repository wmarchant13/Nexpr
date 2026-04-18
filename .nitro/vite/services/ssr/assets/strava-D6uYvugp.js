import { c as createServerRpc } from "./createServerRpc-B7qvQyGJ.js";
import { _ as createServerFn } from "../server.js";
import "node:async_hooks";
import "node:stream";
import "node:stream/web";
import "util";
import "crypto";
import "async_hooks";
import "stream";
async function fetchFromStrava(endpoint, accessToken) {
  const response = await fetch(`https://www.strava.com/api/v3${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Strava API error: ${error.message || response.statusText}`);
  }
  return response.json();
}
const getAthlete_createServerFn_handler = createServerRpc({
  id: "ea3e6ffcf7f8567fd9ff559f16d3bf6185ca1c045c3183591d4c9704507a53cd",
  name: "getAthlete",
  filename: "src/api/strava.ts"
}, (opts) => getAthlete.__executeServer(opts));
const getAthlete = createServerFn({
  method: "GET"
}).inputValidator((input) => input).handler(getAthlete_createServerFn_handler, async ({
  data
}) => fetchFromStrava("/athlete", data.accessToken));
const getActivities_createServerFn_handler = createServerRpc({
  id: "8d24b1404747be8b48fd30bdf931924de3d897236fcb5d242f53f38b7ca5789d",
  name: "getActivities",
  filename: "src/api/strava.ts"
}, (opts) => getActivities.__executeServer(opts));
const getActivities = createServerFn({
  method: "GET"
}).inputValidator((input) => input).handler(getActivities_createServerFn_handler, async ({
  data
}) => {
  const {
    accessToken,
    page = 1,
    perPage = 20
  } = data;
  return fetchFromStrava(`/athlete/activities?page=${page}&per_page=${perPage}`, accessToken);
});
const getActivity_createServerFn_handler = createServerRpc({
  id: "ceea8d9bfc07bfde12a43c7591ad58bbc0153f62cca4495bf47d9102adc8cc32",
  name: "getActivity",
  filename: "src/api/strava.ts"
}, (opts) => getActivity.__executeServer(opts));
const getActivity = createServerFn({
  method: "GET"
}).inputValidator((input) => input).handler(getActivity_createServerFn_handler, async ({
  data
}) => fetchFromStrava(`/activities/${data.id}`, data.accessToken));
const getStats_createServerFn_handler = createServerRpc({
  id: "730706da68dc73f668d21e04610a4a25811254b36a37cb962d4a7b09a7e8f8cc",
  name: "getStats",
  filename: "src/api/strava.ts"
}, (opts) => getStats.__executeServer(opts));
const getStats = createServerFn({
  method: "GET"
}).inputValidator((input) => input).handler(getStats_createServerFn_handler, async ({
  data
}) => fetchFromStrava(`/athletes/${data.athleteId}/stats`, data.accessToken));
export {
  getActivities_createServerFn_handler,
  getActivity_createServerFn_handler,
  getAthlete_createServerFn_handler,
  getStats_createServerFn_handler
};
