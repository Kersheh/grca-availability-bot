import * as puppeteer from 'puppeteer';
import nconf from 'nconf';
import { mapSeries } from 'bluebird';

import { send } from './email';
import type { MapArea, SiteAvailability, AvailableSites } from './types';
import { addDays, isAfter, parseISO } from 'date-fns';
import { formatDate } from './utils';

const config = nconf.file({ file: `./config/config.json` });
const DEBUG = process.env.DEBUG ?? false;

const mapAreaLakeview: MapArea = { id: '-2147483623', mapArea: 'Lakeview' };
const mapAreaLookoutPoint: MapArea = { id: '-2147483625', mapArea: 'Lookout Point' };
const mapAreaSandyBay: MapArea = { id: '-2147483624', mapArea: 'Sandy Bay' };
const mapAreaHillcrest: MapArea = { id: '-2147483622', mapArea: 'Hillcrest' };
const mapAreaSunrise: MapArea = { id: '-2147483621', mapArea: 'Sunrise' };

const mapAreas = !DEBUG ? [
  mapAreaLakeview,
  mapAreaLookoutPoint,
  mapAreaSandyBay,
  mapAreaHillcrest,
  mapAreaSunrise
] : [
  mapAreaLakeview
];

// debug with hardcoded dates in September as we know we get mixed results for testing
const START_DATE: string = !DEBUG ? config.get('GRCA:START_DATE') : config.get('GRCA:DEBUG_START_DATE');
const END_DATE: string = !DEBUG ? config.get('GRCA:END_DATE') : config.get('GRCA:DEBUG_END_DATE');

const getURL = (mapId: string) => `${nconf.get('GRCA:URL')}&startDate=${START_DATE}&endDate=${END_DATE}&mapId=${mapId}`;

const executePuppeteerBot = async (url: string, mapArea: string) => {
  console.debug(`grca-bot > ${url}`);

  const browser = await puppeteer.launch({
    executablePath: process.env.DOCKER_ENV === 'Y' ? '/usr/bin/google-chrome' : '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: process.env.NODE_ENV !== 'production' ? !DEBUG : true
  });

  console.debug('grca-bot > Puppeteer launched');

  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    Referer: 'https://www.google.com/',
});

  await page.goto(url, { waitUntil: 'networkidle0' });

  console.debug('grca-bot > Puppeteer loaded page');

  await page.evaluate(() => {
    (document.querySelector('#grid-view-button-button') as HTMLButtonElement).click();
  });

  console.debug('grca-bot > Puppeteer clicked Calendar button');

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

  console.debug('grca-bot > Puppeteer retrieved table data');

  const sites = await tableQueryHandle.jsonValue();
  const sitesAvailableAllWeekend = sites
    .filter((s) => s.friday && s.saturday && s.sunday)
    .map((s) => s.site);

  console.debug('grca-bot > Puppeteer closing');

  await browser.close();

  return { mapArea, url, sitesAvailable: sitesAvailableAllWeekend };
};

// fetch search result html page
(async () => {
  if (isAfter(new Date(), addDays(parseISO(START_DATE), 1))) {
    console.error(`grca-bot > Today's date ${formatDate(new Date().toISOString())} is after the start date ${formatDate(START_DATE)}`);
    console.log('grca-bot > Shutting down bot');
    process.exit(1);
  }

  try {
    console.log(`grca-bot > Running scrape of Guelph Lake GRCA map areas`, mapAreas.map((area) => area.mapArea));

    // execute in sequence to avoid DDoS
    const availableSites: AvailableSites = await mapSeries(
      mapAreas, (area) => {
        console.log(`grca-bot > Checking ${area.mapArea} for available sites...`);
        return executePuppeteerBot(getURL(area.id), area.mapArea);
      }
    );

    const filteredAvailableSites: AvailableSites = availableSites.filter((area) => area.sitesAvailable.length > 0);

    if (filteredAvailableSites.length > 0) {
      console.log('grca-bot > Newly available sites:', filteredAvailableSites);

      send(filteredAvailableSites, {
        startDate: START_DATE,
        endDate: END_DATE
      });
    } else {
      console.log('grca-bot > No newly available sites found.');
    }
  } catch(err) {
    console.error(`grca-bot > ${err}`);
    process.exit(1);
  }
})();
