import dayjs = require('dayjs');
import customParseFormat = require('dayjs/plugin/customParseFormat');
import isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
import isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
import timezone = require('dayjs/plugin/timezone');
import utc = require('dayjs/plugin/utc');

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);

export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

export function nowArgentina() {
  return dayjs().tz(ARGENTINA_TIMEZONE);
}

export function nowArgentinaDateForDatabase() {
  return dayjs(nowArgentina().format('YYYY-MM-DDTHH:mm:ss')).toDate();
}

export function formatArgentinaDateTime(value: Date | string) {
  return dayjs(value).tz(ARGENTINA_TIMEZONE).format('YYYY-MM-DDTHH:mm:ss');
}

export function formatLocalDateTime(value: Date | string) {
  return dayjs(value).format('YYYY-MM-DDTHH:mm:ss');
}

export default dayjs;
