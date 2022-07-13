export type MapArea = {
  id: string;
  mapArea: string;
}

export type SiteAvailability = {
  site: string;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export type AvailableSites = Array<{
  mapArea: string;
  sitesAvailable: Array<string>;
}>

export type DateRange = {
  startDate: string;
  endDate: string;
}