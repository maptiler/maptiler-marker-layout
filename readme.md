# MapTiler Marker layout for MapTiler SDK
The Marker Layout is a helper to create non-coliding marker overlays on top of MapTiler SDK. Fed by a **vector layer** from a tileset or from a GeoJSON source, it can be tuned with plenty of options.
Thanks to its non opinionated and logic-only approach, it lets you bind any kind of rendering you wish for your markers: vanilla HTML Divs, React components, floating canvas, etc. as it computes the position and size of the markers but lets you take handle the rendering part.

## Some Examples
Here is only a few examples of what's possible with fairly basic HTML markers.

With markers anchored to the city layers, directly fueled by the `streets-v2` style from MapTiler Cloud:
![](images/cities.png)

Displaying weather data is also a nice usecase. For this, we anchor the markers to cities, towns and villages from an official MapTiler Cloud style and then we asynchronously fetch the weather data using [MapTiler Weather library](https://www.maptiler.com/weather/), for each vector features using their coordinates:
![](images/weather_europe_large.png)
![](images/weather_usa_large.png)

**But markers don't need to look like markers!** Smaller merkers with transparent background are a nice way to avoid cluter. Icons are SVG animated:
![](images/weather_minimal.png)

Since markers are overlaying on top of a map, it's generally a good practice to keep them small, so that the basemap remains readable, but **Marker Layout** does not technically enforce that.

## Some Concepts
The Marker Layout...
- computes screen-space bounding box logic
- can be provided the desired marker size and relative anchor point
- is fed with one or multiple vector layer
- can only use *point* features
- create non-overlapping bounding boxes
- can filter and sort features based on vector feature properties
- sorting can be done with a function, so that rank can come from an external source
- can group multiple vector features into each marker
- when updated will retrieve three lists of markers relative to the previous state: the new, the removed and the moved markers
- does not enforce how the the actual visual markers (eg. divs) should be created, cached, pooled, reused or deleted

## Usage
To install it:
```bash
npm install @maptiler/marker-layout
```
Then, import it:

```ts
import { MarkerLayout } from "@maptiler/marker-layout";

...

const markerLayout = new MarkerLayout(map, options);
```


Or it can be used from MapTiler Cloud CDN with vanilla JS:

```html
<script src="https://cdn.maptiler.com/maptiler-marker-layout/v1.0.0/maptiler-marker-layout.umd.js"></script>
```
And then be address as such:
```js
const markerLayout = new maptilermarkerlayout.MarkerLayout(map, options);
```

### Options
Here are all the options available:
```ts
{
  /**
   * IDs of layers to query for vector features.
   * Default: uses all the layers available
   */
  layers?: Array<string>;

  /**
   * Size of the markers on screen space [width, height].
   * Default: `[150, 50]`
   */
  markerSize?: [number, number];

  /**
   * Maximum number of markers to keep.
   * Default: no maximum
   */
  max?: number;

  /**
   * Position of the marker relative to its anchor point.
   * Default: `"center"`
   */
  markerAnchor?: MarkerAnchor;

  /**
   * Offset to apply to the marker, in number of pixel, relative to its anchor position.
   * First element of the array is the horizontal offset where negative shifts towards
   * the left and positive shifts towards the right.
   * Second element of the array is the vertical offset where negative shifts towards
   * the top and positive shifts towards the bottom.
   * Default: `[0, 0]`
   */
  offset?: [number, number];

  /**
   * A filter function can be provided. Each feature will be tested against this filter function,
   * and the returned value can be `true` (the feature is kept) or `false` (the feature is discarded).
   * Default: none
   */
  filter?: (feature: MapGeoJSONFeature) => boolean;

  /**
   * Property to sort the features by. If not provided, the features will not be sorted.
   * Default: not provided
   */
  sortingProperty?: string,

  /**
   * Property to sort the features by. If not provided, the features will not be sorted.
   * Alternatively, the sorting property can be a function that takes the feature as
   * argument and returns a number, aka. the sorting value (or rank)
   * Default: not provided
   */
  sortingProperty?: string | ((feature: MapGeoJSONFeature) => number);

  /**
   * Property to group by. The property must be present in the `properties` object of the feature
   * unless the value of `groupBy` is equal to `"coordinates"`, then the geometry coordinates are
   * being used.
   * Default: no grouping
   */
  groupBy?: string,

  /**
   * Markers can contain multiple vector features, this parameter can be set to have a strict limit.
   * Default: `Infinity`
   */
  maxNbFeaturesPerMarker?: number,

  /**
   * When a marker contains multiple features, its size can get bigger. This number is the max ratio applied to the
   * defined `markerSize`. Intentionnaly non-integer so that the user can see there is still half an element to
   * show at the bottom and undestand they can scroll for more.
   * Default: `2.5`
   */
  maxRatioUnitSize?: number,
}

// The possible anchor points
type MarkerAnchor = "center" | "top" | "bottom" | "left" | "right";
```

## API
Appart from the constructor, there are a few things to get familiar with.

### AbstractMarker
They are simple data structure that hold informations about a marker (position, size)
and the list of vector features it is supposed to contain. Here is how it looks like:

```ts
type AbstractMarker = {
  /**
   * Unique ID of a marker, most likely the ID of a geojson feature (from a vector tile)
   */
  id: number;

  /**
   * Position in screenspace of the top-left corner [x, y]
   */
  position: [number, number];

  /**
   * Size in screen space [width, height]
   */
  size: [number, number];

  /**
   * The feature represented by the marker
   */
  features: MapGeoJSONFeature[];

  /**
   * Size of each internal elements (useful for when a marker contain multiple vector features)
   */
  internalElementSize: [number, number],
};
```
Again, an *abstract marker* is **not** an actual visual marker. It only aims at providing the information to help making an actual graphic representation of a marker.

### MarkerMap
The type `MarkerMap` is simply a [JS Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) of `AbstractMarker`. The *key* of this map (*number*) is a hash specific to one of multiple vector features contained by a marker. If you want to add an extra caching logic, you may want to track this ID, otherwise it's only used internaly and is of little interest at application level.

```ts
type MarkerMap = Map<number, AbstractMarker>;
```

### markerStatus
An object of type *markerStatus* is a simple data structure that contain li

```ts
/**
 * Status of the marker compared to the previous status
 */
type MarkerStatus = {
  /**
   * The markers that were added since the last update()
   */
  new: MarkerMap;

  /**
   * The markers that were already present in the last update but had their position changed
   */
  updated: MarkerMap;

  /**
   * The markers that are no longer present since the last update
   */
  removed: MarkerMap;
};
```

### Methods
As we interact with the map (pan, zoom, rotation, etc.) we need to know which markers are now visible, disapeared outside the viewport or are still visible but at a different (screen space) location.

To compute this, a `MarkerLayout` instance has two methods:
- `.update()` compute a complete new status of markers, returning a `MarkerStatus`.  
In case many vector features are found in the specified `layers` with the provided `filter`, this may have an impact on performances and may not be suitable to call from a `map.on("move", () => { ... })` event.


- `.softUpdateAbstractMarker(am)` only update a single `AbstractMarker` with a new screenspace position.  
This is convenient to use when there are hundreds of vector features found but we only want to update the position, say, of the ones retrieved with the previous full `.update()` call. In this performance-wise conservative mode, one would typically bind `.update()` to the `Map` event `"idle"` and bind `.softUpdateAbstractMarker(am)` to the `Map` event `"move"`.

We can also reset the internal `MarkerStatus` if we need to restart from a blank slate without creating a new `MarkerLayout` instance:
- `.reset()`

## Examples
You can find two examples in this repo:
- demo using only `.update()` [here](demos/cities.html)
- demo using both `.update()` and `.softUpdateAbstractMarker()` [here](demos/cities-many.html)
