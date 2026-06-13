import dayjs = require('dayjs');
import customParseFormat = require('dayjs/plugin/customParseFormat');
import isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
import isSameOrBefore = require('dayjs/plugin/isSameOrBefore');

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export function formatLocalDateTime(value: Date | string) {
  return dayjs(value).format('YYYY-MM-DDTHH:mm:ss');
}

export default dayjs;
