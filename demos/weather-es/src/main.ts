
import { config, Map, MapStyle } from "@maptiler/sdk";
import "@maptiler/sdk/style.css";
import {
  PrecipitationLayer,
  TemperatureLayer,
  WindLayer,
  RadarLayer,
  ColorRamp,
} from "@maptiler/weather";
import './style.css'
import { makeMarker, updateMarkerDiv } from "./markermaker";
import { AbstractMarker, MarkerLayout, MarkerStatus } from "./marker-layout/src/markerlayout";


(async () => {
  const pageURL = new URL(window.location.href)
  let apiKey = pageURL.searchParams.get("key");

  // testing the API key and asking for one if not provided
  while (true) {
    const testURL = `https://api.maptiler.com/tiles/v3/tiles.json?key=${apiKey}`;
    const testResponse = await fetch(testURL);
    
    if (!testResponse.ok) {
      apiKey = prompt("The MapTiler API key is missing or invalid.\nPlease provide it below:");
    } else {
      break;
    }
  }

  if (!apiKey) {
    return;
  }

  pageURL.searchParams.set("key", apiKey);
  window.history.replaceState(null, "", pageURL.href);
  
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  // Configuring the SDK with MapTiler API key 
  config.apiKey = apiKey;

  // Instanciating the map
  const map = new Map({
    container: appContainer,
    // style: CustomTopoStyle as StyleSpecification,
    style: MapStyle.BASIC,
    hash: true,
    maptilerLogo: true,
    geolocate: true,
  });

  // Waiting that the map is "loaded"
  // (this is equivalent to putting the rest of the code the "load" event callback)
  await map.onLoadAsync();

  // The marker manager is in charge of computing the positions where markers
  // should be, sort them by POI rank and select non-overlaping places.
  // (it does not actually create DOM elements, it just uses logical points and bounding boxes)
  const markerManager = new MarkerLayout(map, {
    layers: ["City labels", "Place labels"],
    markerSize: [40, 70],
    offset: [0, -10],
    markerAnchor: "center",
    filter: ((feature) => {
      return ["city", "village", "town"].includes(feature.properties.class)
    })
  });
  
  // Creating the weather layers...
  // Temperature will be used as the main overlay
  const temperatureLayer = new TemperatureLayer({opacity: 0.7});

  // Radar will be using the cloud color ramp and used as a cloud overlay
  const radarLayer = new RadarLayer({colorramp: ColorRamp.builtin.RADAR_CLOUD});

  // From the wind layer, we only display the particles (the background is using the NULL color ramp, which is transparent).
  // The slower particles are transparent, the fastest are opaque white
  const windLayer = new WindLayer({colorramp: ColorRamp.builtin.NULL, color: [255, 255, 255, 0], fastColor: [255, 255, 255, 100]});

  // The precispitation layer is created but actually not displayed.
  // It will only be used for picking precipitation metrics at the locations of the markers
  const precipitationLayer = new PrecipitationLayer({colorramp: ColorRamp.builtin.NULL});

  // Setting the water layer partially transparent to increase the visual separation between land and water
  map.setPaintProperty("Water", "fill-color", "rgba(0, 0, 0, 0.7)")
  map.addLayer(temperatureLayer, "Place labels");
  map.addLayer(windLayer)
  map.addLayer(radarLayer);
  map.addLayer(precipitationLayer);

  // Waiting for weather data readyness
  await temperatureLayer.onSourceReadyAsync();
  await radarLayer.onSourceReadyAsync();
  await windLayer.onSourceReadyAsync();
  await precipitationLayer.onSourceReadyAsync();

  // Creating the div that will contain all the markers
  const markerContainer = document.createElement("div");
  appContainer.appendChild(markerContainer);

  // This object contains the marker DIV so that they can be updated rather than fully recreated every time
  const markerLogicContainer: {[key: number]: HTMLDivElement} = {};

  let markerStatus: MarkerStatus | null = null;
  // This function will be used as the callback for some map events
  const updateMarkers = () => {
    markerStatus = markerManager.update();
    
    if (!markerStatus) return;

    // Remove the div that corresponds to removed markers
    markerStatus.removed.forEach((pb: AbstractMarker) => {
      const markerDiv = markerLogicContainer[pb.id];
      delete markerLogicContainer[pb.id];
      markerContainer.removeChild(markerDiv);
    });

    // Update the div that corresponds to updated markers
    markerStatus.updated.forEach((pb: AbstractMarker) => {
      const markerDiv = markerLogicContainer[pb.id];
      updateMarkerDiv(pb, markerDiv);
    });

    // Create the div that corresponds to the new markers
    markerStatus.new.forEach((pb: AbstractMarker) => {
      const markerDiv = makeMarker(pb, temperatureLayer, radarLayer,precipitationLayer, new Date());
      markerLogicContainer[pb.id] = markerDiv;
      markerContainer.appendChild(markerDiv);
    });
  }


  const softUpdateMarkers = () => {
    // A previous run of .update() yieding no result or not being ran at all
    // would stop the soft update
    if (!markerStatus) return;

    markerStatus.updated.forEach((abstractMarker) => {
      markerManager.softUpdateAbstractMarker(abstractMarker);
      const markerDiv = markerLogicContainer[abstractMarker.id];
      updateMarkerDiv(abstractMarker, markerDiv);
    })

    markerStatus.new.forEach((abstractMarker) => {
      markerManager.softUpdateAbstractMarker(abstractMarker);
      const markerDiv = markerLogicContainer[abstractMarker.id];
      updateMarkerDiv(abstractMarker, markerDiv);
    })
  }

  // The "idle" event is triggered every second because of the particle layer being refreshed,
  // even though their is no new data loaded, so this approach proved to be the best for this scenario
  map.on("move", softUpdateMarkers);

  map.on("moveend", updateMarkers);

  map.once("idle", () => {
    updateMarkers();
  });
  
})()