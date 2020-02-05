const puppeteer = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const pluginUA = require('puppeteer-extra-plugin-anonymize-ua')
const jsonfile = require('jsonfile')
const fs = require('fs')
const download = require('download')
const dotenv = require('dotenv')

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const moment = require('moment-timezone')

const args = [
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

const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36'

class Spider {

	constructor(env) {

		dotenv.config()

		puppeteer.use(pluginStealth())
		puppeteer.use(pluginUA())

		this.isDevelopmentEnv = env === 'DEVELOPMENT'
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

	}

	async saveCookies(cookiesPath) {

		const cookiesFilePath = cookiesPath || this.cookiesPath

		const cookiesObject = await this.page.cookies()
		jsonfile.writeFileSync(cookiesFilePath, cookiesObject, { spaces: 2 })
		console.log(`Cookies saved: ${cookiesPath}`)

	}

	async setCookies(cookiesPath) {

		const cookiesFilePath = cookiesPath || this.cookiesPath

		if (fs.existsSync(cookiesFilePath)) {

			const content = fs.readFileSync(cookiesFilePath)
			const cookiesArr = JSON.parse(content)

			if (cookiesArr.length !== 0) {

				for (const cookie of cookiesArr) await this.page.setCookie(cookie)

				console.log('Session has been loaded in the browser')

			}

		}

	}

	async createBrowser() {

		this.browser = await puppeteer.launch({
			headless: !this.isDevelopmentEnv,
			devtools: false,
			dumpio: this.isDevelopmentEnv,
			ignoreHTTPSErrors: !this.isDevelopmentEnv,
			slowMo: 250,
			timeout: this.isDevelopmentEnv ? 10000 : 60000,
			defaultViewport: null,
			args,
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

		// const min = 0
		// const max = desktopUserAgents.length
		// const random = parseInt(Math.random() * (+max - +min) + +min, 10)

		await this.page.setUserAgent(userAgent)

		// if (userAgentType === 'desktop') await this.page.setUserAgent(desktopUserAgents[random])
		// else await this.page.setUserAgent(mobileUserAgents[random])

	}

	async navigateTo(url, postBack) {

		try {

			console.log(`Navigating to url: ${url}`)

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

				console.log(`Error on getting the page contents. Response status: ${headers.status}`)

				return false

			}

			return true

		} catch (err) {

			console.log(`Error on navigateTo url ${url}: ${err}, taking screenshot`)

			const pathToSaveScreenshot = `./logs/screenshots/${await moment()
				.format('YYYY-MM-DDTHH-mm-ss-SSS')}_error.png`

			await this.page.screenshot({
				path: pathToSaveScreenshot,
				fullPage: true,
			})

			console.log(`Screenshot saved: ${pathToSaveScreenshot}`)

			return false

		}

	}

	async click(elementToClick, elementToWait, timeToWait) {

		try {

			console.log(`Clicking on element: ${elementToClick}`)

			await this.page.click(elementToClick)

			if (!elementToWait) return

			console.log(`And then waiting for element: ${elementToWait}`)

			if (!timeToWait) {

				await this.page.waitForSelector(elementToWait, { timeout: 120000 })

				return

			}

			await this.page.waitForSelector(elementToWait, { timeout: timeToWait })

		} catch (err) {

			console.log(`Error on click: ${err}, taking screenshot`)
			const pathToSaveScreenshot = `./logs/screenshots/${await moment()
				.format('YYYY-MM-DDTHH-mm-ss-SSS')}_error.png`

			await this.page.screenshot({
				path: pathToSaveScreenshot,
				fullPage: true,
			})

			console.log(`Screenshot saved: ${pathToSaveScreenshot}`)

			return false

		}

	}

	async typeInput(elementToType, textToType, maxRandomTime) {

		try {

			console.log(`Typying text on ${elementToType}`)
			await this.page.focus(elementToType)
			const min = 0
			const max = maxRandomTime || 5000
			for (let i = 0; i < textToType.length; i++) {

				const random = parseInt(Math.random() * (+max - +min) + +min, 10)
				const chart = textToType.charAt(i)
				await this.page.type(elementToType, chart)
				await sleep(random)

			}

		} catch (err) {

			console.log(`Error on typeInput: ${err}, taking screenshot`)

			const pathToSaveScreenshot = `./logs/screenshots/${await moment()
				.format('YYYY-MM-DDTHH-mm-ss-SSS')}_error.png`

			await this.page.screenshot({
				path: pathToSaveScreenshot,
				fullPage: true,
			})

			console.log(`Screenshot saved: ${pathToSaveScreenshot}`)

			return false

		}

	}

	async reload() {

		await this.navigateTo(this.page.url())

	}

	async evaluate(elementToEvaluate, waitForElement) {

		try {

			console.log(`Evaluating: ${elementToEvaluate}`)

			if (waitForElement) {

				console.log(`but first waiting for element ${waitForElement}`)
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

			console.log(`Error on elementToEvaluate: ${err}, taking screenshot`)

			const pathToSaveScreenshot = `./logs/screenshots/${await moment()
				.format('YYYY-MM-DDTHH-mm-ss-SSS')}_error.png`

			await this.page.screenshot({
				path: pathToSaveScreenshot,
				fullPage: true,
			})

			console.log(`Screenshot saved: ${pathToSaveScreenshot}`)

			return false

		}

	}

	downloadFile(url) {

		download(url, this.downloadPath)
			.then(() => {

				console.log('done downloading!')

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

}

module.exports = Spider
