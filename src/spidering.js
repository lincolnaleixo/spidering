const puppeteer = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const pluginUA = require('puppeteer-extra-plugin-anonymize-ua')
const jsonfile = require('jsonfile')
const fs = require('fs')
const download = require('download')
const UserAgent = require('user-agents')
const { Random } = require('random-js')
const moment = require('moment-timezone')
const cawer = require('cawer')
const Logger = require('./logger.js')

class Spidering {

	constructor() {

		// dotenv.config()

		puppeteer.use(pluginStealth())
		puppeteer.use(pluginUA())

		const logger = new Logger('spidering')

		this.isDevelopmentEnv = process.env.ENVIROMENT === 'DEVELOPMENT'
		this.dir = '.'
		this.downloadPath = `${this.dir}/downloads`
		this.typeOptions = [
			'full',
			'clean',
			'veryClean',
		]
		this.cookiesPath = `${this.dir}/cookies/browserCookies`
		this.browser = ''
		this.page = ''
		this.logger = logger.get()

	}

	async saveCookies(cookiesPath) {

		const cookiesFilePath = cookiesPath || this.cookiesPath

		const cookiesObject = await this.page.cookies()
		jsonfile.writeFileSync(cookiesFilePath, cookiesObject, { spaces: 2 })
		this.logger.info(`Cookies saved: ${cookiesPath}`)

	}

	async setCookies(cookiesPath) {

		const cookiesFilePath = cookiesPath || this.cookiesPath

		this.logger.info('Reading and setting cookies')

		if (fs.existsSync(cookiesFilePath)) {

			const content = fs.readFileSync(cookiesFilePath)
			const cookiesArr = JSON.parse(content)

			if (cookiesArr.length !== 0) {

				for (const cookie of cookiesArr) await this.page.setCookie(cookie)

				this.logger.info('Session has been loaded in the browser')

			}

		}

		this.logger.info('Done reading and setting cookies')

	}

	async createBrowser(proxy) {

		this.args = [
			'--disable-gpu',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--force-device-scale-factor',
			'--ignore-certificate-errors',
			'--no-sandbox',
			'--mute-audio',
			'--disable-translate',
			'--disable-features=site-per-process',
			'--window-size=1920,1080',

		]

		if (proxy) {

			this.args.push(`--proxy-server=${proxy}`)
			this.logger.info(`Using proxy ${proxy}`)

		}

		this.browser = await puppeteer.launch({
			headless: !this.isDevelopmentEnv,
			devtools: false,
			dumpio: this.isDevelopmentEnv,
			ignoreHTTPSErrors: !this.isDevelopmentEnv,
			slowMo: 250,
			timeout: this.isDevelopmentEnv ? 10000 : 60000,
			defaultViewport: null,
			args: this.args,
		})

	}

	async createPage() {

		this.page = await this.browser.newPage()
		await this.setPageParameters()

	}

	async setPageParameters() {

		this.page.on('dialog', async (dialog) => {

			await dialog.accept()

		})
		if (this.type === 'clean') {

			await this.page.setRequestInterception(true)

			this.page.on('request', (request) => {

				if (
					request.resourceType() === 'image'
						|| request.resourceType() === 'font'
				) {

					request.abort()

				} else {

					request.continue()

				}

			})

		} else if (this.type === 'veryClean') {

			await this.page.setRequestInterception(true)

			this.page.on('request', (request) => {

				if (
					request.resourceType() === 'image'
						|| request.resourceType() === 'script'
						|| request.resourceType() === 'stylesheet'
						|| request.resourceType() === 'font'
				) {

					request.abort()

				} else {

					request.continue()

				}

			})

		}

		await this.page._client.send('Page.setDownloadBehavior', {
			behavior: 'allow',
			downloadPath: this.downloadPath,
		})

		await this.setRandomUserAgent()

	}

	async navigateTo(url, postBack) {

		try {

			this.logger.info(`Navigating to url: ${url}`)

			const response = await this.page.goto(url, { waitUntil: [
				'networkidle0',
				'load',
				'domcontentloaded',
			] })

			if (postBack) {

				const headers = response.headers()

				if (headers.status === '200') {

					return true

				}

				this.logger.error(`Error on getting the page contents. Response status: ${headers.status}`)

				return false

			}

			return true

		} catch (err) {

			this.logger.error(`Error on navigateTo url ${url}: ${err}`)

			// TODO implment taking screenshot on error
			// const pathToSaveScreenshot = `./logs/screenshots/${await moment()
			// 	.format('YYYY-MM-DDTHH-mm-ss-SSS')}_error.png`

			// await this.page.screenshot({
			// 	path: pathToSaveScreenshot,
			// 	fullPage: true,
			// })

			// this.logger.notice(`Screenshot saved: ${pathToSaveScreenshot}`)

			return false

		}

	}

	async setRandomUserAgent() {

		// TODO only chrome desktop now supported
		const userAgent = new UserAgent([
			/Chrome/, {
				connection: { type: 'wifi' },
				deviceCategory: 'desktop',
			},
		])

		await this.page.setUserAgent(userAgent.data.userAgent)

	}

	async click(elementToClick, elementToWait, timeToWait) {

		try {

			this.logger.debug(`Clicking on element: ${elementToClick}`)

			await this.page.click(elementToClick)

			if (!elementToWait) return

			this.logger.debug(`And then waiting for element: ${elementToWait}`)

			if (!timeToWait) {

				await this.page.waitForSelector(elementToWait, { timeout: 120000 })

				return

			}

			await this.page.waitForSelector(elementToWait, { timeout: timeToWait })

		} catch (err) {

			this.logger.error(`Error on click: ${err}, taking screenshot`)
			this.takeScreenshot(true)

		}

	}

	async hover(elementToHover, elementToWait, timeToWait) {

		try {

			this.logger.debug(`Hovering on element: ${elementToHover}`)

			await this.page.hover(elementToHover)

			if (!elementToWait) return

			this.logger.debug(`And then waiting for element: ${elementToWait}`)

			if (!timeToWait) await this.page.waitForSelector(elementToWait, { timeout: 120000 })
			else await this.page.waitForSelector(elementToWait, { timeout: timeToWait })

		} catch (err) {

			this.logger.error(`Error on hover: ${err}, taking screenshot`)
			this.takeScreenshot(true)

		}

	}

	async typeInput(elementToType, textToType, maxRandomTimeMs) {

		try {

			this.logger.info(`Typying text on ${elementToType}`)
			await this.page.focus(elementToType)
			const min = 500
			const max = maxRandomTimeMs || 5000
			for (let i = 0; i < textToType.length; i += 1) {

				const random = new Random()
				const randomSleepMs = random.real(min, max)

				const char = textToType.charAt(i)
				await this.page.type(elementToType, char)
				await this.logger.debug(`Typying char ${char}`)
				await cawer.msleep(randomSleepMs)

			}

		} catch (err) {

			this.logger.error(`Error on typeInput: ${err}, taking screenshot`)
			this.takeScreenshot(true)

		}

	}

	async reload() {

		await this.navigateTo(this.page.url())

	}

	async evaluate(elementToEvaluate, waitForElement) {

		try {

			this.logger.info(`Evaluating: ${elementToEvaluate}`)

			if (waitForElement) {

				this.logger.info(`but first waiting for element ${waitForElement}`)
				await this.page.waitForSelector(waitForElement, { timeout: 120000 })

			}

			// async use inside strings is necessary to fix errors if app is packaged with pkg.
			// if pkg not necessary, just use normal evaluate

			// * normal evaluate
			// const evaluateResult = await page.evaluate(() =>
			// Array.from(document.querySelectorAll('.result__a')).map((item) => item.innerText));
			const evaluateResult = await this.page.evaluate(`(async() => {
				return ${elementToEvaluate}
	  	})()`)

			return evaluateResult

		} catch (err) {

			this.logger.error(`Error on elementToEvaluate: ${err}, taking screenshot`)

			this.takeScreenshot(true)

		}

	}

	downloadFile(url) {

		download(url, this.downloadPath)
			.then(() => {

				this.logger.notice('done downloading!')

			})

	}

	async closeBrowser(cookiesFilePath = false) {

		if (cookiesFilePath) await this.saveCookies(cookiesFilePath)

		await this.page.close()
		await this.browser.close()

	}

	async takeListingFullScreenShot(page, asin) {

		// let logger
		// try {
		//
		// 	const pathScreenshots = await this.getEnvironmentPath()
		// 	const fileName = `${asin}_${moment()
		// 		.tz('America/Los_Angeles')
		// 		.format('DD-MM-YY')}.jpeg`
		//
		// 	await page.screenshot({
		// 		path: path.join(pathScreenshots, 'screenshots', fileName),
		// 		type: 'jpeg',
		// 		quality: 50,
		// 		fullPage: true,
		// 	})
		//
		// 	return true
		//
		// } catch (error) {
		//
		// 	logger.error(error)
		//
		// 	return false
		//
		// }

	}

	async scrollPage(scrollCount) {

		while (true) {

			try {

				for (let i = 0; i < scrollCount; i += 1) {

					console.log(`[${i + 1}/${scrollCount}] scrolling...`)
					await this.page.evaluate((_) => {

						window.scrollBy(0, window.innerHeight)
						window.scrollTo(0, document.body.scrollHeight)

					})

					cawer.sleep(3)

				}

			} catch (error) {

				this.logger.error(`Error on scrolling: ${error}\ntrying again in 30 seconds`)
				cawer.sleep(30)

			}

			break

		}

	}

	async takeScreenshot(isError = false, path) {

		const todayDate = await moment()
			.format('YYYY-MM-DDTHH-mm-ss-SSS')
		let pathToSaveScreenshot = ''

		if (isError) {

			const folderPath = process.mainModule.paths[0].split('node_modules')[0].slice(0, -1)
			const dir1 = 'logs'
			const screenshotsDir = `${dir1}/screenshots`

			if (!fs.existsSync(dir1)) fs.mkdirSync(dir1)
			if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir)

			pathToSaveScreenshot = `${folderPath}/../${screenshotsDir}/${todayDate}_error.png`

		} else {

			pathToSaveScreenshot = `${path}/${todayDate}_error.png`

		}

		await this.page.screenshot({
			path: pathToSaveScreenshot,
			fullPage: true,
		})

		this.logger.warn(`Screenshot saved: ${pathToSaveScreenshot}`)

	}

}

module.exports = Spidering
