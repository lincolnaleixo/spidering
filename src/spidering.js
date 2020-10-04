/* eslint-disable complexity */
/* eslint-disable require-jsdoc */
const puppeteer = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
const pluginUA = require('puppeteer-extra-plugin-anonymize-ua')
const jsonfile = require('jsonfile')
const fs = require('fs-extra')
const download = require('download')
const { Random } = require('random-js')
const moment = require('moment-timezone')
const Cawer = require('cawer')
const axios = require('axios')
const cheerio = require('cheerio')
const UserAgent = require('user-agents')
const appRoot = require('app-root-path')
const path = require('path')
const defaults = require('../resources/defaults.json')

class Spidering {

	constructor() {
		if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = defaults.environment
		this.isDevelopmentEnv = (process.env.NODE_ENV === 'DEVELOPMENT')
		process.setMaxListeners(100)

		// @ts-ignore
		puppeteer.use(pluginStealth())
		// @ts-ignore
		puppeteer.use(pluginUA())

		this.cawer = new Cawer()
	}

	/**
	 * @param {string} cookiesPath
	 */
	async saveCookies(cookiesPath) {
		try {
			this.cookiesPath = cookiesPath
			const cookiesObject = await this.page.cookies()
			jsonfile.writeFileSync(cookiesPath, cookiesObject, { spaces: 2 })
		} catch (err) {
			throw new Error(`Error on saveCookies: ${err}`)
		}
	}

	/**
	 * @param {any} cookiesPath
	 */
	async setCookies(cookiesPath) {
		try {
			this.cookiesPath = cookiesPath

			if (fs.existsSync(cookiesPath)) {
				const cookiesContent = jsonfile.readFileSync(cookiesPath)

				if (cookiesContent.length !== 0) {
					for (const cookie of cookiesContent) await this.page.setCookie(cookie)
				}
			}
		} catch (err) {
			throw new Error(`Error on setCoookies: ${err}`)
		}
	}

	// ----------------------------------------------------------------------
	/**
	 * @param {object} options
	 */
	async createBrowser(options) {
		try {
			if (options && options.proxy) defaults.chromeArgs.push(`--proxy-server=${options.proxy}`)

			const flags = {
				headless: !this.isDevelopmentEnv,
				devtools: this.isDevelopmentEnv,
				dumpio: this.isDevelopmentEnv,
				ignoreHTTPSErrors: !this.isDevelopmentEnv,
				slowMo: options && options.slowMo ? options.slowMoMs : defaults.slowMoMs.min,
				timeout: this.isDevelopmentEnv ? defaults.timeout.development : defaults.timeout.max,
				defaultViewport: null,
				args: defaults.chromeArgs,
			}

			if (options && options.endpointServer) {
				let endpointWithFlags = `${options.endpointServer}?${defaults.chromeArgs.join('&')}`
				if (options.blockAds) endpointWithFlags += '&blockAds'

				// @ts-ignore
				this.browser = await puppeteer.connect({
					browserWSEndpoint: `ws://${endpointWithFlags}`,
					ignoreHTTPSErrors: true,
					slowMo: flags.slowMo,
				})
			} else {
				// @ts-ignore
				this.browser = await puppeteer.launch(flags)
			}
		} catch (err) {
			throw new Error(`Error on createBrowser: ${err}`)
		}
	}

	/**
	 * @param {string} pageType
	 */
	async createPage(pageType = 'full', defaultTimeout = 30000) {
		try {
			this.page = await this.browser.newPage()
			await this.setPageParameters(pageType)
			await this.page.setDefaultNavigationTimeout(defaultTimeout)
		} catch (err) {
			throw new Error(`Error on createPage: ${err}`)
		}
	}

	async setCleanParameters() {
		await this.page.setRequestInterception(true)

		this.page.on('request', (request) => {
			if (request.resourceType() === 'image' || request.resourceType() === 'font') {
				request.abort()
			} else {
				request.continue()
			}
		})
	}

	async setVeryCleanParameters() {
		await this.page.setRequestInterception(true)

		const blockedResourceTypes = [
			'image',
			'font',
			'script',
			'stylesheet',
		]

		this.page.on('request', (request) => {
			if (blockedResourceTypes.indexOf(request.resourceType()) > -1) {
				request.abort()
			} else {
				request.continue()
			}
		})
	}

	/**
	 * @param {string} pageType
	 */
	async setPageParameters(pageType) {
		this.page.on('dialog', async (dialog) => {
			await dialog.accept()
		})
		if (pageType === 'clean') {
			await this.setCleanParameters()
		} else if (pageType === 'veryClean') {
			await this.setVeryCleanParameters()
		}

		await this.page._client.send('Page.setDownloadBehavior', {
			behavior: 'allow',
			downloadPath: path.join(appRoot.path, defaults.downloadsFolder),
		})

		await this.setRandomUserAgent()
	}

	/**
	 * @param {any} url
	 * @param {object} err
	 */
	async handleNavigateToErrors(url, err) {
		const errorHandler = defaults.errorsHandlers
			.find((item) => err.message.indexOf(item.errorMessage) > -1)

		if (errorHandler === undefined) {
			throw new Error(`Error on navigateTo url ${url}: ${err}`)
		} else {
			await this.cawer.sleep(errorHandler.sleepingSeconds)
		}

		await this.takeScreenshot(true)

		return true
	}

	/**
	 * @param {string} selector
	 */
	async checkIfElementExists(selector) {
		if (await this.page.$(selector) !== null) return true

		return false
	}

	/**
	 * @param {string} url
	 */
	async navigateTo(url) {
		try {
			this.url = url

			const response = await this.page.goto(url, { waitUntil: [
				'networkidle0',
				'load',
				'domcontentloaded',
			] })
			const headers = response.headers()
			if (headers.status && headers.status !== '200') {
				throw new Error(`Error on getting the page contents. Response status: ${headers.status}`)
			}

			const bytesReceived = await this.getTotalBytesReceived()

			return bytesReceived
		} catch (err) {
			if (this.handleNavigateToErrors(url, err)) this.navigateTo(url)

			throw new Error(`Error on navigateTo: ${err}`)
		}
	}

	/**
	 * @param {string} deviceCategory
	 * @param {string} type
	 */
	async setRandomUserAgent(deviceCategory = 'desktop', type = 'wifi') {
		const userAgent = new UserAgent([
			/Chrome/, {
				connection: { type },
				deviceCategory,
			},
		])

		await this.page.setUserAgent(userAgent.data.userAgent)
	}

	/**
	 * @param {any} elementToClick
	 * @param {any} elementToWait
	 * @param {any} timeToWait
	 */
	async click(elementToClick, elementToWait, timeToWait = 120000) {
		try {
			await this.page.click(elementToClick)

			if (!elementToWait) return

			await this.page.waitForSelector(elementToWait, { timeout: timeToWait })
		} catch (err) {
			await this.takeScreenshot(true)
			throw new Error(`Error on click: ${err}`)
		}
	}

	/**
	 * @param {any} elementToHover
	 * @param {any} elementToWait
	 * @param {any} timeToWait
	 */
	async hover(elementToHover, elementToWait, timeToWait, timeout = 120000) {
		try {
			await this.page.hover(elementToHover)

			if (!elementToWait) return

			if (!timeToWait) await this.page.waitForSelector(elementToWait, { timeout })
			else await this.page.waitForSelector(elementToWait, { timeout: timeToWait })
		} catch (err) {
			await this.takeScreenshot(true)
			throw new Error(`Error on hover: ${err}`)
		}
	}

	/**
	 * @param {any} elementToType
	 * @param {string} textToType
	 * @param {number} maxRandomTimeMs
	 */
	async typeInput(elementToType, textToType, maxRandomTimeMs = 5000, minRandomTimeMS = 500) {
		try {
			await this.page.focus(elementToType)
			for (let i = 0; i < textToType.length; i += 1) {
				const random = new Random()
				const randomSleepMs = random.real(minRandomTimeMS, maxRandomTimeMs)
				const char = textToType.charAt(i)
				await this.page.type(elementToType, char)

				await this.cawer.msleep(randomSleepMs)
			}
		} catch (err) {
			await this.takeScreenshot(true)
			throw new Error(`Error on typeInput: ${err}`)
		}
	}

	async reload() {
		await this.navigateTo(this.page.url())
	}

	async getTotalBytesReceived() {
		try {
			const result = await this.page.evaluate(() => JSON.stringify(performance.getEntries()))
			const bytesReceived = this.cawer.formatBytes((JSON.parse(result))
				.reduce((total, item) => total + (item.transferSize !== undefined ? item.transferSize : 0), 0))

			return bytesReceived
		} catch (err) {
			return '0 bytes'
		}
	}

	/**
	* Scrape a page using axios+cheerio
	* @param {Object} retryTimes how much times to retry the scrape
	* @param {Object} options Options to scrape,
	params accepted: element, script, scriptWithoutReturn, url
	*/
	// eslint-disable-next-line consistent-return
	async scrape(options, retryTimes = 3) {
		try {
			if (!options.element) throw new Error('No element specified')

			return this.scrapeElement(options.url, options.element)
		} catch (err) {
			if (retryTimes === 0) throw new Error(`Error on scrape ${err}`)
			this.cawer.sleep(60)
			await this.scrape(options, retryTimes - 1)
		}
	}

	/**
	 * @param {any} url
	 * @param {any} element
	 */
	async scrapeElement(url, element) {
		// @ts-ignore
		const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.122 Safari/537.36' } })
		const $ = cheerio.load(response.data)
		const content = $(`${element}`)

		return content
	}

	/**
	 * @param {any} scriptToEvaluate
	 * @param {any} waitForElement
	 */
	async evaluate(scriptToEvaluate, waitForElement, isReturnable = true) {
		try {
			if (waitForElement) {
				await this.page.waitForSelector(waitForElement, { timeout: 120000 })
			}

			if (isReturnable) {
				return await this.page.evaluate(`(async() => { return ${scriptToEvaluate} })()`)
			}

			await this.page.evaluate(`(async() => { ${scriptToEvaluate} })()`)
		} catch (err) {
			await this.takeScreenshot(true)
			await this.saveFullHtmlContent(true)

			throw new Error(`Error on evaluate: ${err}`)
		}

		return true
	}

	/**
	 * @param {string} url
	 */
	downloadFile(url) {
		download(url, path.join(appRoot.path, defaults.downloadsFolder))
			.then(() => {
				// this.logger.notice('done downloading!')
			})
	}

	/**
	 * @param {string} cookiesFilePath
	 */
	async closeBrowser(cookiesFilePath = undefined) {
		if (cookiesFilePath) await this.saveCookies(cookiesFilePath)
		else if (this.cookiesPath) await this.saveCookies(this.cookiesPath)

		await this.page.close()
		await this.browser.close()
	}

	/**
	 * @param {number} scrollCount
	 * @param {number} scrollHeight
	 */
	// @ts-ignore
	// eslint-disable-next-line no-unused-vars
	async scrollPage(scrollCount, scrollHeight = undefined) {
		while (true) {
			try {
				for (let i = 0; i < scrollCount; i += 1) {
					// console.log(`[${i + 1}/${scrollCount}] scrolling...`)
					// eslint-disable-next-line no-shadow
					await this.page.evaluate((scrollHeight) => {
						window.scrollBy(0, scrollHeight || window.innerHeight)
						// window.scrollTo(0, document.body.scrollHeight)
					})

					this.cawer.sleep(3)
				}
			} catch (error) {
				throw new Error(`Error on scrollPage : ${error}`)
			}

			break
		}
	}

	/**
	 * @param {boolean} isError
	 * @param {string} pathToSave
	 */
	async takeScreenshot(isError = false, pathToSave = undefined, fullPage = true) {
		try {
			let pathToSaveScreenshot = pathToSave

			// TODO retirar os escapes e testar se funciona legal
			if (isError) {
				const matches = this.url.match(/^https?\:\/\/(?:www\.)?([^\/?#]+)(?:[\/?#]|$)/i)
				const domain = matches && matches[1]
				const todayDate = moment()
					.format('YYYY-MM-DDTHH-mm-ss-SSS')
				pathToSaveScreenshot = path
					.join(appRoot.path, 'logs', 'screenshots', `${domain}_${todayDate}_error.png`)
			}

			fs.ensureDirSync(pathToSaveScreenshot)
			await this.page.screenshot({
				path: pathToSaveScreenshot,
				fullPage,
			})
		} catch (err) {
			throw new Error(`Error on takeScreenshot: ${err}`)
		}
	}

	/**
	 * @param {boolean} isError
	 * @param {string} pathToSave
	 */
	async saveFullHtmlContent(isError = false, pathToSave = undefined) {
		try {
			let pathToSaveHTML = pathToSave
			const todayDate = moment()
				.format('YYYY-MM-DDTHH-mm-ss-SSS')
			const bodyHTML = await this.page.evaluate(() => document.body.innerHTML)

			if (isError) {
				const matches = this.url.match(/^https?\:\/\/(?:www\.)?([^\/?#]+)(?:[\/?#]|$)/i)
				const domain = matches && matches[1]
				pathToSaveHTML = path
					.join(appRoot.path, 'logs', 'html', `${domain}_${todayDate}_error.html`)
			}

			fs.ensureDirSync(pathToSaveHTML)
			fs.writeFileSync(pathToSaveHTML, bodyHTML)
		} catch (err) {
			throw new Error(`Error on saveFullHtmlContent: ${err}`)
		}
	}

}

module.exports = Spidering
