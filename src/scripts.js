/* eslint-disable no-unused-vars */
const path = require('path');
const request = require('request');
const fs = require('fs');
const moment = require('moment-timezone');
const homedir = require('os').homedir();
const shell = require('shelljs');
const {
  createLogger,
  format,
  transports,
} = require('winston');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const colorizer = format.colorize();

module.exports = {

  async prepareLogger(module) {

    const dir = await this.getEnvironmentPath();
    const logPath = `${dir}/logs/`;
    const {
      combine,
      printf,
    } = format;

    const alignedWithTime = format.combine(
      format.align(),
      format.printf((info) => `${Date.now().toString()}\t${moment().tz('America/Los_Angeles').format('YYYY-MM-DDTHH:mm:ss.SSS')}\t${module}\t${info.level}\t${info.message}`),
    );

    const logger = createLogger({
      level: 'debug',
      format: alignedWithTime,
      transports: [
        new transports.File({
          filename: path.join(logPath, 'error.log'),
          level: 'error',
          format: alignedWithTime,
        }),
        new transports.File({
          filename: path.join(logPath, 'combined.log'),
        }),
        new transports.File({
          filename: path.join(logPath, `${module}.log`),
        }),
      ],
    });

    if (process.pkg) {

      logger.add(
        new transports.Console({
          level: 'info',
          format: format.printf((msg) => colorizer.colorize(msg.level, `${Date.now().toString()}\t${moment().tz('America/Los_Angeles').format('YYYY-MM-DDTHH:mm:ss.SSS')}\t${module}\t${msg.message}`)),
        }),
      );

    } else {

      logger.add(
        new transports.Console({
          level: 'debug',
          format: format.printf((msg) => colorizer.colorize(msg.level, `${Date.now().toString()}\t${moment().tz('America/Los_Angeles').format('YYYY-MM-DDTHH:mm:ss.SSS')}\t${module}\t${msg.message}`)),
        }),
      );

    }

    return logger;

  },

  formatBytes(a, b) {

    if (a === 0) return '0 Bytes';
    const c = 1024;
    const d = b || 2;
    const e = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const f = Math.floor(Math.log(a) / Math.log(c));
    return `${parseFloat((a / Math.pow(c, f)).toFixed(d))} ${e[f]}`;

  },

  async savingImage(imageUrl, dir, sku) {

    try {

      let imagePath;
      let success;

      imagePath = path.join(dir, `${sku}.jpg`);
      if (imageUrl !== undefined) {

        success = this.download(imageUrl, imagePath);
        if (success !== false) {

          return imagePath;

        }
        return 'no image';

      }
      return 'no image';

    } catch (error) {

      // logger.error(`Error on gettingImage: ${error}`);

    }

  },

  async download(uri, filename) {

    try {

      request.head(uri, (err, res, body) => {

        request(uri).pipe(fs.createWriteStream(filename));

      });

    } catch (e) {

      return false;

    }

    return true;

  },

  async getFullTodayDate() {

    const date = new Date();
    let d = `${date.getFullYear()}-`;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    d = `${d + month}-`;
    d = `${d + (date.getDate() < 10 ? `0${date.getDate()}` : date.getDate())} `;
    d = `${d + (date.getHours() < 10 ? `0${date.getHours()}` : date.getHours())}:`;
    d += (date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes());
    return d;

  },

  async convertToAmazonTime(date) {

    return moment(date).tz('America/Los_Angeles').format('YYYY-MM-DDTHH:mm:ss.SSS');

  },

  async formatDateLA(dateLA) {

    const date = new Date(dateLA);
    let d = `${date.getFullYear()}-`;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    d = `${d + month}-`;
    d = `${d + (date.getDate() < 10 ? `0${date.getDate()}` : date.getDate())}T`;
    d = `${d + (date.getHours() < 10 ? `0${date.getHours()}` : date.getHours())}:`;
    d = `${d + (date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes())}:`;
    d = `${d + (date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds())}PST`;
    return d;

  },

  async fileExists(pathDb) {

    return !!(await fs.existsSync(pathDb));

  },

  async formatCurrenctyUSD(value) {

    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    return formatter.format(value);

  },

  async timeConversion(millisec) {

    const seconds = (millisec / 1000).toFixed(1);
    const minutes = (millisec / (1000 * 60)).toFixed(1);
    const hours = (millisec / (1000 * 60 * 60)).toFixed(1);
    const days = (millisec / (1000 * 60 * 60 * 24)).toFixed(1);

    if (seconds < 60) {

      return `${seconds} Sec`;

    } if (minutes < 60) {

      return `${minutes} Min`;

    } if (hours < 24) {

      return `${hours} Hrs`;

    }
    return `${days} Days`;

  },

  async isDev() {

    return path.join(__dirname, '').indexOf('app.asar') < 0;

  },

  async detailedError(err) {

    let log = '';
    if (typeof err === 'object') {

      if (err.message) {

        log = `\nMessage: ${err.message}`;

      }
      if (err.stack) {

        log += '\nStacktrace:';
        log += '====================';
        log += err.stack;

      }

    } else {

      log += 'dumpError :: argument is not an object';

    }

    return log;

  },

  async takeListingFullScreenShot(page, asin) {

    let logger;
    try {

      logger = await this.prepareLogger('scripts');
      const pathScreenshots = await this.getEnvironmentPath();
      const fileName = `${asin}_${moment()
        .tz('America/Los_Angeles')
        .format('DD-MM-YY')}.jpeg`;

      await page.screenshot({
        path: path.join(pathScreenshots, 'screenshots', fileName),
        type: 'jpeg',
        quality: 50,
        fullPage: true,
      });

      return true;

    } catch (error) {

      logger.error(error);
      return false;

    }

  },

  async getEnvironmentPath() {

    let dir;
    switch (process.platform) {

      // TODO tirar shell porque so funciona em linux e mac
      case 'darwin':
        dir = path.join(homedir, 'Library/Application Support/ConquerAmazon');
        break;
      case 'linux':
        dir = path.join(homedir, 'ConquerAmazon');
        break;
      case 'win32':
        dir = path.join(homedir, 'ConquerAmazon');
        break;
      default:
        break;

    }

    return dir;

  },

  async createSystemFolders(dir) {

    shell.mkdir('-p', dir);
    shell.mkdir('-p', path.join(dir, 'database'));
    shell.mkdir('-p', path.join(dir, 'images'));
    shell.mkdir('-p', path.join(dir, 'logs'));
    shell.mkdir('-p', path.join(dir, 'backup'));
    shell.mkdir('-p', path.join(dir, 'downloads'));
    shell.mkdir('-p', path.join(dir, 'screenshots'));

    shell.mkdir('-p', path.join(dir, 'database', 'history'));
    shell.mkdir('-p', path.join(dir, 'database', 'history', 'inventory'));
    shell.mkdir('-p', path.join(dir, 'database', 'history', 'products'));

  },

  // async createEverything() {

  //   Database.CreateTables();

  // },

  async chill() {

    const min = 2000;
    const max = 7000;
    const random = Math.floor(Math.random() * (+max - +min)) + +min;

    await sleep(random);
    return random;

  },

  async miniChill() {

    const min = 150;
    const max = 950;
    const random = Math.floor(Math.random() * (+max - +min)) + +min;

    await sleep(random);
    return random;

  },

  async cacheDatabase() {

    try {

      let user;
      const doNotCacheList = ['.DS_Store', 'history', 'ads_reports', 'ads', 'system'];

      const dir = await this.getEnvironmentPath();
      const databases = await fs.readdirSync(path.join(dir, 'database'));

      for (let index = 0; index < databases.length; index += 1) {

        if (doNotCacheList.find((item) => item === databases[index]) === undefined) {

          const adapter = new FileSync(path.join(dir, `database/${databases[index]}`));
          user = low(adapter);
          user.read();

        }

      }

    } catch (error) {

      console.log(`Error on cacheDatabase: ${error}`);

    }

  },

  async sleepWithMs(ms) {

    await sleep(ms);

  },

  async sleepWithSeconds(seconds) {

    await sleep(seconds * 1000);

  },

};
