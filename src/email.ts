import nconf from 'nconf';
import nodemailer from 'nodemailer';

import type { AvailableSites, DateRange } from './types';

const config = nconf.file({ file: `./config/config.json` });
const DEBUG = process.env.DEBUG ?? false;

const smtpTransport = nodemailer.createTransport({
  service: config.get('NOTIFICATION:TRANSPORT:SERVICE'),
  auth: {
    user: config.get('NOTIFICATION:TRANSPORT:EMAIL'),
    pass: config.get('NOTIFICATION:TRANSPORT:PASSWORD')
  }
});

export const send = async (results: AvailableSites, dates: DateRange) => {
  const emailRecipients: Array<string> = config.get('NOTIFICATION:OUTGOING:EMAIL');
  const emailBody = results.reduce((acc, val) =>
    `${acc}✓ ${val.mapArea} -- ${val.sitesAvailable.reduce((a, v) => `${!a ? a : `${a}, `}${v}`, '')}<br/><a href=${val.url} target="_blank" rel="noopener noreferrer">${val.url}</a><br/><br/>`,
    `<b>Date Range: ${dates.startDate} to ${dates.endDate}</b><br/><b>Newly Available GRCA Sites:</b><br/><br/>`
  );

  const mailOptions = {
    from: config.get('NOTIFICATION:TRANSPORT:EMAIL'),
    to: !DEBUG ? emailRecipients.reduce((acc, val) => `${acc ? `${acc},${val}` : `${val}`}`, '') : emailRecipients[0],
    subject: 'GRCA Site Availability Update (!)',
    html: emailBody
  };

  try {
    await smtpTransport.sendMail(mailOptions);
    console.log(`Mail sent to ${mailOptions.to}`);
  } catch(err) {
    console.error(`Failed to send mail to ${mailOptions.to}`, err);
  }
};
