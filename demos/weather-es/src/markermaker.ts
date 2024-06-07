import { PrecipitationLayer, RadarLayer, TemperatureLayer } from "@maptiler/weather";
import * as suncalc from "suncalc";
import { AbstractMarker } from "./marker-layout/src/markerlayout";
import "./marker-style.css";

export function makeMarker(
  abstractMarker: AbstractMarker, 
  temperatureLayer: TemperatureLayer,
  radarLayer: RadarLayer,
  precipitationLayer: PrecipitationLayer,
  date: Date,
): HTMLDivElement {
  const marker = document.createElement("div");
  marker.classList.add("marker");
  marker.classList.add('fade-in-animation');
  marker.style.setProperty("width", `${abstractMarker.size[0]}px`);
  marker.style.setProperty("height", `${abstractMarker.size[1]}px`);
  marker.style.setProperty("transform", `translate(${abstractMarker.position[0]}px, ${abstractMarker.position[1]}px)`);
  
  const lonLat = (abstractMarker.features[0].geometry as GeoJSON.Point).coordinates;    
  const temperatureData = temperatureLayer.pickAt(lonLat[0], lonLat[1]);
  const precipitationData = precipitationLayer.pickAt(lonLat[0], lonLat[1]);
  
  const radarData = radarLayer.pickAt(lonLat[0], lonLat[1]);
  
  let mainWeatherIconURL = "weather-icons/";
  const radarDBz: number = radarData?.value || -20;
  const precipMmH = precipitationData?.value || 0;
  const temperatureDeg = temperatureData?.value || 0;
  const temperature = temperatureData?.value.toFixed(1) as string;

  const sunPosition = suncalc.getPosition(date, lonLat[1], lonLat[0]); 

  if (sunPosition.altitude < 0) {
    mainWeatherIconURL += "night-";
  } else {
    mainWeatherIconURL += "day-";
  }

  if (radarDBz < 0) {

    if (precipMmH > 0.2) {
      mainWeatherIconURL += "cloudy-";
    } else {
      mainWeatherIconURL += "clear-";
    }

    
  } else if (radarDBz < 10) {
    mainWeatherIconURL += "cloudy-";
  } else if (radarDBz < 20) {
    mainWeatherIconURL += "overcast-";
  } else {
    mainWeatherIconURL += "extreme-";
  }

  if (precipMmH > 5) {
    mainWeatherIconURL += (temperatureDeg < -1 ? "snow" : "rain");
  } else if (precipMmH > 0.2) {
    mainWeatherIconURL += (temperatureDeg < -1 ? "snow" : "drizzle");
  } else {
    mainWeatherIconURL += "none";
  }


  mainWeatherIconURL += ".svg";


  marker.innerHTML = `
    <img class="markerMainWeatherIcon" src=${mainWeatherIconURL}></img>
    <div class="markerTemperature">${temperature}°</div>
  `

  return marker;
}



export function updateMarkerDiv(abstractMarker: AbstractMarker, marker: HTMLDivElement) {
  marker.style.setProperty("width", `${abstractMarker.size[0]}px`);
  marker.style.setProperty("height", `${abstractMarker.size[1]}px`);
  marker.style.setProperty("transform", `translate(${abstractMarker.position[0]}px, ${abstractMarker.position[1]}px)`);
}