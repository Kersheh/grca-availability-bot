import * as puppeteer from 'puppeteer';
import nconf from 'nconf';
import { mapSeries } from 'bluebird';

import { send } from './email';
import type { MapArea, SiteAvailability, AvailableSites } from './types';

const config = nconf.file({ file: `./config/config.json` });
const DEBUG = process.env.DEBUG ?? false;

const mapAreaLakeview: MapArea = { id: '-2147483623', mapArea: 'Lakeview' };
const mapAreaLookoutPoint: MapArea = { id: '-2147483625', mapArea: 'Lookout Point' };
const mapAreaSandyBay: MapArea = { id: '-2147483624', mapArea: 'Sandy Bay' };
const mapAreaHillcrest: MapArea = { id: '-2147483622', mapArea: 'Hillcrest' };
const mapAreaSunrise: MapArea = { id: '-2147483621', mapArea: 'Sunrise' };

const mapAreas = [
  mapAreaLakeview,
  mapAreaLookoutPoint,
  mapAreaSandyBay,
  mapAreaHillcrest,
  mapAreaSunrise
];

// debug with hardcoded dates in September as we know we get mixed results for testing
const START_DATE = !DEBUG ? config.get('GRCA:START_DATE') : '2022-09-02';
const END_DATE = !DEBUG ? config.get('GRCA:END_DATE') : '2022-09-05';

const getURL = (mapId: string) => `${nconf.get('GRCA:URL')}&startDate=${START_DATE}&endDate=${END_DATE}&mapId=${mapId}`;

const executePuppeteerBot = async (url: string, mapArea: string) => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    headless: !DEBUG
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  await page.evaluate(() => {
    (document.querySelector('[aria-label="Calendar View"]') as HTMLButtonElement).click();
  });

  await page.waitForNetworkIdle();

  const tableQueryHandle = await page.evaluateHandle(() => {
    return [...document.getElementsByTagName('table')[0].rows]
      .splice(1)
      .map<SiteAvailability>((row) => ({
        site: row.cells[0].innerText.split('\n')[0],
        friday: row.cells[1].classList.contains('grid-available'),
        saturday: row.cells[2].classList.contains('grid-available'),
        sunday: row.cells[3].classList.contains('grid-available')
      }));
  });

  const sites = await tableQueryHandle.jsonValue<Array<SiteAvailability>>();
  const sitesAvailableAllWeekend = sites
    .filter((s) => s.friday && s.saturday && s.sunday)
    .map((s) => s.site);

  await browser.close();

  return { mapArea, sitesAvailable: sitesAvailableAllWeekend };
};

// fetch search result html page
(async () => {
  try {
    console.log(`Running scrape of Guelph Lake GRCA map areas`, mapAreas.map((area) => area.mapArea));

    // execute in sequence to avoid DDoS
    const availableSites: AvailableSites = await mapSeries(
      mapAreas, (area) => executePuppeteerBot(getURL(area.id), area.mapArea)
    );

    const filteredAvailableSites: AvailableSites = availableSites.filter((area) => area.sitesAvailable.length > 0);

    if (filteredAvailableSites.length > 0) {
      console.log('Newly available sites:', filteredAvailableSites);

      send(filteredAvailableSites, {
        startDate: START_DATE,
        endDate: END_DATE
      });
    } else {
      console.log('No newly available sites found.');
    }
  } catch(err) {
    console.log(err);
  }
})();
