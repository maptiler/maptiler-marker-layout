import { LngLatLike, Map as MapSDK, MapGeoJSONFeature } from "@maptiler/sdk";

/**
 * How the popups are anchored to a given point
 */
export type PopupAnchor = "center" | "top" | "bottom" | "left" | "right";

/**
 * Minimalist set of properties that represent a popup
 */
export type AbstractPopup = {
  /**
   * Unique ID of a popup, most likely the ID of a geojson feature (from a vector tile)
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
   * The feature represented by the popup
   */
  features: MapGeoJSONFeature[];

  /**
   * Size of each internal elements (useful for when a popup contain information about multiple feature)
   */
  internalElementSize: [number, number];
};

/**
 * Hash map of AbstractPopup where IDs are unique and likely to come from vector tiles
 */
export type PopupMap = Map<number, AbstractPopup>;

/**
 * Status of the popup compared to the previous status
 */
export type PopupStatus = {
  /**
   * The popups that were added since the last update
   */
  new: PopupMap;

  /**
   * The popups that were already present in the last update but had their position changed
   */
  updated: PopupMap;

  /**
   * The popups that are no longer present since the last update
   */
  removed: PopupMap;
};

export type PopupManagerOptions = {
  /**
   * IDs of layers to query for vector features.
   * Default: uses all the layers available
   */
  layers?: Array<string>;

  /**
   * Size of the popups on screen space [width, height].
   * Default: `[150, 50]`
   */
  popupSize?: [number, number];

  /**
   * Maximum number of popups to keep.
   * Default: no maximum
   */
  max?: number;

  /**
   * Position of the popup compared to its anchor point.
   * Default: `"center"`
   */
  popupAnchor?: PopupAnchor;

  /**
   * Offset to apply to the popup, in number of pixel, relative to its anchor position.
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
  sortingProperty?: string;

  /**
   * Sorting order, only relevant if the option `.sortingProperty` is provided, or else will be ignored.
   * Default: `"ascending"`
   */
  sortingOrder?: "ascending" | "descending";

  /**
   * Property to group by. The property must be present in the `properties` object of the feature
   * unless the value of `groupBy` is equal to `"coordinates"`, then the geometry coordinates are
   * being used.
   * Default: no grouping
   */
  groupBy?: string;

  /**
   * Popups can contain multiple features, this parameter can be set to have a strict limit.
   * Default: `Infinity`
   */
  maxNbFeaturesPerPopup?: number;

  /**
   * When a popup contains multiple features, its size can get bigger. This number is the max ratio applied to the
   * defined `popupSize`. Intentionnaly non-integer so that the user can see there is still half an element to
   * show at the bottom and undestand they can scroll for more.
   * Default: `2.5`
   */
  maxRatioUnitSize?: number;
};

export type FeatureGroup = {
  groupKey: string | number | boolean;
  features: MapGeoJSONFeature[];
};

function computeFeatureGroupId(features: MapGeoJSONFeature[]): number {
  const ids = features.map((f: MapGeoJSONFeature) => f.id);
  ids.sort();
  const idsStr = ids.join("_");

  let hash = 0;
  for (let i = 0; i < idsStr.length; i++) {
    const char = idsStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

function getPointfeatureCoordinateHash(feature: MapGeoJSONFeature): string {
  if (feature.geometry.type !== "Point") {
    return "";
  }

  const fArr = new Float32Array(feature.geometry.coordinates.slice(0, 2));
  const uiArr = new Uint8Array(fArr.buffer);
  return uiArr.join("_");
}

function doesCollide(a: AbstractPopup, b: AbstractPopup): boolean {
  return !(
    b.position[0] > a.position[0] + a.size[0] ||
    b.position[0] + b.size[0] < a.position[0] ||
    b.position[1] > a.position[1] + a.size[1] ||
    b.position[1] + b.size[1] < a.position[1]
  );
}

function doesCollideWithAny(
  popup: AbstractPopup,
  manyPopups: PopupMap,
): boolean {
  const popups = manyPopups.values();
  for (const hitTestPopup of popups) {
    if (doesCollide(popup, hitTestPopup)) {
      return true;
    }
  }

  return false;
}

export class PopupManager {
  /**
   * Style layer IDs to keep
   */
  private layers: Array<string> | undefined;
  private popupSize: [number, number];
  private popupAnchor: PopupAnchor;
  private map: MapSDK;
  private lastStatus: PopupStatus;
  private max: number | null;
  private offset: [number, number] = [0, 0];

  /**
   * This is a concat of lastStatus.new and lastStatus.updated
   * only for optimisation purposes
   */
  private lastPresent: PopupMap;
  private filter: null | ((feature: MapGeoJSONFeature) => boolean) = null;
  private groupBy: string | null = null;
  private maxRatioUnitSize: number;
  private sortingProperty: string = "";
  private sortingOrder: number = 1;
  private maxNbFeaturesPerPopup: number = Infinity;

  constructor(map: MapSDK, options: PopupManagerOptions = {}) {
    this.map = map;
    this.layers = options.layers ?? undefined;
    this.popupAnchor = options.popupAnchor ?? "center";
    this.popupSize = options.popupSize ?? [150, 50];
    this.max = options.max ?? null;
    this.lastStatus = {
      new: new Map<number, AbstractPopup>(),
      updated: new Map<number, AbstractPopup>(),
      removed: new Map<number, AbstractPopup>(),
    };
    this.lastPresent = new Map<number, AbstractPopup>();
    this.filter = options.filter ?? null;
    this.offset = options.offset ?? [0, 0];
    this.groupBy = options.groupBy ?? null;
    this.maxRatioUnitSize = options.maxRatioUnitSize ?? 2.5;
    this.sortingProperty = options.sortingProperty ?? "";
    this.maxNbFeaturesPerPopup = options.maxNbFeaturesPerPopup ?? Infinity;

    if (
      options.sortingOrder &&
      !["ascending", "descending"].includes(options.sortingOrder)
    ) {
      throw new Error(
        "The property `options.sortingOrder` must be 'ascending' or 'descending' if provided.",
      );
    }

    this.sortingOrder = options.sortingOrder === "descending" ? -1 : 1;
  }

  private computeAnchorOffset(nbFeatures: number = 1): [number, number] {
    let anchorOffset: [number, number] = [0, 0];

    if (this.popupAnchor === "center") {
      anchorOffset = [
        -this.popupSize[0] / 2,
        (nbFeatures * -this.popupSize[1]) / 2,
      ];
    } else if (this.popupAnchor === "top") {
      anchorOffset = [-this.popupSize[0] / 2, nbFeatures * -this.popupSize[1]];
    } else if (this.popupAnchor === "bottom") {
      anchorOffset = [-this.popupSize[0] / 2, 0];
    } else if (this.popupAnchor === "left") {
      anchorOffset = [
        -this.popupSize[0],
        (nbFeatures * -this.popupSize[1]) / 2,
      ];
    } else if (this.popupAnchor === "right") {
      anchorOffset = [0, -this.popupSize[1]];
    }

    anchorOffset[0] += this.offset[0];
    anchorOffset[1] += this.offset[1];

    return anchorOffset;
  }

  /**
   * Updates only the position of an abstract popup. Soft updates are convenients
   * for updating already existing popups without the need to debounce
   */
  softUpdateAbstractPopup(abstractPopup: AbstractPopup) {
    const lonLat = (abstractPopup.features[0].geometry as GeoJSON.Point)
      .coordinates as LngLatLike;
    const screenspacePosition = this.map.project(lonLat);
    const nbFeatureToShow = Math.min(
      abstractPopup.features.length,
      this.maxRatioUnitSize,
    );
    const anchorOffset = this.computeAnchorOffset(nbFeatureToShow);
    abstractPopup.position[0] = screenspacePosition.x + anchorOffset[0];
    abstractPopup.position[1] = screenspacePosition.y + anchorOffset[1];
  }

  /**
   * Update the popup positions.
   */
  update(): PopupStatus | null {
    if (!this.map) return null;

    // Collecting the features displayed in the viewport
    let features = this.map.queryRenderedFeatures(undefined, {
      layers: this.layers,
    });

    // Keeping only points
    features = features.filter((f) => f.geometry.type === "Point");

    // filtering out with the custom filter function
    if (typeof this.filter === "function") {
      features = features.filter(this.filter);
    }

    if (this.sortingProperty) {
      // sorting the features by a property (eg. rank)
      features = features
        .filter((feature) => feature.properties[this.sortingProperty]) // the features must have the property to sort on
        .sort(
          (a, b) =>
            (a.properties[this.sortingProperty] >
            b.properties[this.sortingProperty]
              ? 1
              : -1) * this.sortingOrder,
        ); // actual sorting
    }

    // The keys of these groups are the values of tyhe parameter we want to group by
    // or the coordinate hash.
    const groupMap = new Map<string, FeatureGroup>();

    // Alongside the groupMap, FeatureGroups are also referenced in a list
    // so that they can be addressed in a sorted way if a sorting property was defined
    // or to conserve the encoding order.
    let groupList: FeatureGroup[] = [];

    // Group by coordinates
    if (this.groupBy) {
      for (let i = 0; i < features.length; i += 1) {
        const feature = features[i];
        const groupKey =
          this.groupBy === "coordinates"
            ? getPointfeatureCoordinateHash(feature)
            : feature.properties[this.groupBy];

        let group: FeatureGroup;

        if (groupMap.has(groupKey)) {
          group = groupMap.get(groupKey) as FeatureGroup;
        } else {
          group = {
            groupKey,
            features: [],
          };
          groupMap.set(groupKey, group);
          groupList.push(group);
        }

        if (group.features.length < this.maxNbFeaturesPerPopup) {
          group.features.push(feature);
        }
      }
    }

    // Do not group at all
    else {
      groupList = features.map((f: MapGeoJSONFeature) => ({
        groupKey: f.id?.toString() as string,
        features: [f],
      }));
      // the groupMap is ignored here because it's used only to create the grouping itself
      // and is not reused afterwards
    }

    const newPopups = new Map<number, AbstractPopup>();
    const updatedPopups = new Map<number, AbstractPopup>();
    const newPresent = new Map<number, AbstractPopup>();

    let featureCounter = 0;

    for (let i = 0; i < groupList.length; i += 1) {
      if (this.max && featureCounter >= this.max) {
        break;
      }

      const group = groupList[i];
      const nbFeatureToShow = Math.min(
        group.features.length,
        this.maxRatioUnitSize,
      );
      const anchorOffset = this.computeAnchorOffset(nbFeatureToShow);
      const feature = group.features[0];

      // The height of the popup is increased based on the number of features
      // it contains, but we don't want the popup to be larger than this.maxRatioUnitSize
      // the size of a "unit" popup (otherwise it could take the whole viewport)
      const popupSize: [number, number] = [
        this.popupSize[0],
        this.popupSize[1] * nbFeatureToShow,
      ];

      const id: number = computeFeatureGroupId(group.features);
      const lonLat = (feature.geometry as GeoJSON.Point)
        .coordinates as LngLatLike;
      const screenspacePosition = this.map.project(lonLat);
      const popup: AbstractPopup = {
        id,
        position: [
          screenspacePosition.x + anchorOffset[0],
          screenspacePosition.y + anchorOffset[1],
        ],
        size: popupSize,
        internalElementSize: [this.popupSize[0], this.popupSize[1]],
        features: group.features,
      };

      if (doesCollideWithAny(popup, newPresent)) {
        continue;
      }

      newPresent.set(id, popup);

      // if current feature was previously in 'new', then it's updated
      if (this.lastStatus.new.has(id)) {
        updatedPopups.set(id, popup);
        this.lastPresent.delete(id);
      }

      // If current feature was previously in 'updated' , then it still is
      else if (this.lastStatus.updated.has(id)) {
        updatedPopups.set(id, popup);
        this.lastPresent.delete(id);
      }

      // If current feature was in previous updated/new, then it is new now
      else {
        newPopups.set(id, popup);
      }

      featureCounter++;
    }

    // All the features of this updates that have been part of the previous update have been deleted from this.lastPresent
    // This means that this.lastPresent is the new removedPopups
    this.lastStatus.removed = this.lastPresent;
    this.lastPresent = newPresent;
    this.lastStatus.new = newPopups;
    this.lastStatus.updated = updatedPopups;

    return this.lastStatus;
  }

  /**
   * Reset the internal state, aka empties the `lastStatus` maps.
   */
  reset() {
    this.lastPresent.clear();
    this.lastStatus.new.clear();
    this.lastStatus.updated.clear();
    this.lastStatus.removed.clear();
  }
}
