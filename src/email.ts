import nconf from 'nconf';
import nodemailer from 'nodemailer';

import type { AvailableSites, DateRange } from './types';
import { formatDate } from './utils';

const config = nconf.file({ file: `./config/config.json` });
const DEBUG = process.env.DEBUG ?? false;
const DEBUG_EMAIL = process.env.DEBUG_EMAIL ?? false;

const smtpTransport = nodemailer.createTransport({
  host: config.get('NOTIFICATION:TRANSPORT:HOST'),
  port: config.get('NOTIFICATION:TRANSPORT:PORT'),
  secure: true,
  auth: {
    user: config.get('NOTIFICATION:TRANSPORT:AUTH:USER'),
    pass: config.get('NOTIFICATION:TRANSPORT:AUTH:PASS')
  }
});

export const send = async (results: AvailableSites, dates: DateRange) => {
  const emailRecipients: Array<string> = !DEBUG ? config.get('NOTIFICATION:OUTGOING:EMAIL') : [config.get('NOTIFICATION:OUTGOING:DEBUG_EMAIL')];
  const emailBody = results.reduce((acc, val) =>
    `${acc}✓ ${val.mapArea} -- ${val.sitesAvailable.reduce((a, v) => `${!a ? a : `${a}, `}${v}`, '')}<br/><a href=${val.url} target="_blank" rel="noopener noreferrer">${val.url}</a><br/><br/>`,
    `<b>Date Range: ${formatDate(dates.startDate)} to ${formatDate(dates.endDate)}</b><br/><b>Newly Available GRCA Sites:</b><br/><br/>`
  );

  const mailOptions = {
    from: `"Matt Breckon" <matt@matthewbreckon.com>`,
    to: emailRecipients.reduce((acc, val) => `${acc ? `${acc},${val}` : `${val}`}`, ''),
    subject: 'GRCA Site Availability Update (!)',
    html: !DEBUG_EMAIL ? emailBody : 'Test email'
  };

  try {
    await smtpTransport.sendMail(mailOptions);
    console.log(`grca-bot > Mail sent to ${mailOptions.to}`);
  } catch(err) {
    console.error(`grca-bot > Failed to send mail to ${mailOptions.to}`, err);
  }
};

// debug email flag to troubleshoot email outbound smtp email
if (DEBUG_EMAIL) {
  send([], { startDate: '2020-01-01', endDate: '2021-01-01' });
}