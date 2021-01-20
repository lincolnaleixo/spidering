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
const rootPath = require('app-root-path').path
const path = require('path')
const defaults = require('../resources/defaults.json')

class Spidering {

	constructor() {
		if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = defaults.environment
		this.isDevelopmentEnv = (process.env.NODE_ENV === 'DEVELOPMENT')
		process.setMaxListeners(100)
		this.createSystemFolders()

		puppeteer.use(pluginStealth())
		puppeteer.use(pluginUA())

		this.cawer = new Cawer()
	}

	createSystemFolders() {
		for (let i = 0; i < defaults.systemFolders; i += 1) {
			const systemFolder = defaults.systemFolders[i]
			fs.ensureDirSync(systemFolder)
		}
	}

	async saveCookies(cookiesPath) {
		try {
			this.cookiesPath = cookiesPath
			const cookiesObject = await this.page.cookies()
			jsonfile.writeFileSync(cookiesPath, cookiesObject, { spaces: 2 })
		} catch (err) {
			throw new Error(`Error on saveCookies: ${err}`)
		}
	}

	async setCookies(cookiesPath) {
		try {
			this.cookiesPath = cookiesPath

			if (fs.existsSync(cookiesPath)) {
				const cookiesContent = jsonfile.readFileSync(cookiesPath)

				if (cookiesContent.length === 0) return

				for (const cookie of cookiesContent) await this.page.setCookie(cookie)
			}
		} catch (err) {
			throw new Error(`Error on setCookies: ${err}`)
		}
	}

  getFlags(options) {
		return {
			headless: options.headless || !this.isDevelopmentEnv,
			devtools: true,
			dumpio: false,
			ignoreHTTPSErrors: !this.isDevelopmentEnv,
			slowMo: options && options.slowMo ? options.slowMoMs : defaults.slowMoMs.min,
			timeout: this.isDevelopmentEnv ? defaults.timeout.development : defaults.timeout.max,
			defaultViewport: null,
			args: defaults.chromeArgs,
      		userDataDir: options.userData ? path.join(rootPath,'chromeUserData') : null,
		}
	}

	async createBrowser(options = {}) {
		try {
			if (options && options.proxy) defaults.chromeArgs.push(`--proxy-server =${options.proxy}`)

			const flags = this.getFlags(options)

			if (options && options.endpointServer) {
				let endpointWithFlags = `${options.endpointServer}?${defaults.chromeArgs.join('&')}`
				if (options.blockAds) endpointWithFlags += '&blockAds'

				this.browser = await puppeteer.connect({
					browserWSEndpoint: `ws://${endpointWithFlags}`,
					ignoreHTTPSErrors: true,
					slowMo: flags.slowMo,
				})
			} else this.browser = await puppeteer.launch(flags)
		} catch (err) {
			throw new Error(`Error on createBrowser: ${err}`)
		}
	}

	async createPage(pageType = 'full', defaultTimeout = 30000,randomizeUserAgent = false) {
		try {
			this.page = await this.browser.newPage()
			await this.setPageParameters(pageType,randomizeUserAgent)
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

	async setPageParameters(pageType,randomizeUserAgent) {
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
			downloadPath: path.join(rootPath, defaults.downloadsFolder),
		})

		if(randomizeUserAgent) await this.setRandomUserAgent()
	}

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

	async checkIfElementExists(selector) {
		return await this.page.$(selector) !== null
	}

  async navigateTo(url,waitLoad=true) {
		try {
			this.url = url
			let waitUntil = {}
			if(waitLoad) waitUntil= [
				'networkidle0',
				'load',
				'domcontentloaded',
			]
			const response = await this.page.goto(url, waitUntil )
			const headers = response.headers()
			if (headers.status && headers.status !== '200') {
				throw new Error(`Error on getting the page contents. Response status: ${headers.status}`)
			}

			return this.getTotalBytesReceived()
		} catch (err) {
			if (await this.handleNavigateToErrors(url, err)) await this.navigateTo(url)

			throw new Error(`Error on navigateTo: ${err}`)
		}
	}

	async setRandomUserAgent(deviceCategory = 'desktop', type = 'wifi') {
		const userAgent = new UserAgent([
			/Chrome/, {
				connection: { type },
				deviceCategory,
			},
		])

		await this.page.setUserAgent(userAgent.data.userAgent)
	}

	async click(elementToClick, elementToWaitBefore, elementToWaitAfter, timeToWait = 120000) {
		try {
			if (elementToWaitBefore) {
				await this.page.waitForSelector(elementToWaitBefore, { timeout: timeToWait })
			}
			await this.page.click(elementToClick)

			if (!elementToWaitAfter) return

			await this.page.waitForSelector(elementToWaitAfter, { timeout: timeToWait })
		} catch (err) {
			await this.takeScreenshot(true)
			throw new Error(`Error on click: ${err}`)
		}
	}

	async select(elementToSelect, valueToSelect, elementToWaitBefore, elementToWaitAfter, timeToWait = 120000) {
		try {
			if (elementToWaitBefore) {
				await this.page.waitForSelector(elementToWaitBefore, { timeout: timeToWait })
			}
			await this.page.select(elementToSelect, valueToSelect)

			if (!elementToWaitAfter) return

			await this.page.waitForSelector(elementToWaitAfter, { timeout: timeToWait })
		} catch (err) {
			await this.takeScreenshot(true)
			throw new Error(`Error on select: ${err}`)
		}
	}

	async hover(elementToHover, elementToWaitBefore, elementToWaitAfter, timeToWait = 120000) {
		try {
			if (elementToWaitBefore) {
				await this.page.waitForSelector(elementToWaitBefore, { timeout: timeToWait })
			}

			await this.page.hover(elementToHover)

			if (!elementToWaitAfter) return

			await this.page.waitForSelector(elementToWaitBefore, elementToWaitAfter, { timeToWait })
		} catch (err) {
			await this.takeScreenshot(true)
			throw new Error(`Error on hover: ${err}`)
		}
	}

	async typeInput(
		elementToType, textToType, elementToWaitBefore,
		maxRandomTimeMs = 5000, minRandomTimeMS = 500, timeToWait = 120000,
	) {
		try {
			if (elementToWaitBefore) {
				await this.page.waitForSelector(elementToWaitBefore, { timeout: timeToWait })
			}
			await this.page.focus(elementToType)
			for (let i = 0; i < textToType.length; i += 1) {
				const char = textToType.charAt(i)
				await this.page.type(elementToType, char)

				await this.cawer.msRandomSleep(maxRandomTimeMs, minRandomTimeMS)
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

	async evaluate(script, waitForElement, timeToWait = 12000) {
		try {
			if (waitForElement) {
				await this.page.waitForSelector(waitForElement, { timeToWait })
			}

			return await this.page.evaluate(`(async() => { return ${script} })()`)
		} catch (err) {
			await this.takeScreenshot(true)
			await this.saveFullHtmlContent(true)

			throw new Error(`Error on evaluate: ${err}`)
		}
	}

	async executeScript(script, waitForElement, timeToWait = 12000) {
		try {
			if (waitForElement) {
				await this.page.waitForSelector(waitForElement, { timeToWait })
			}

			await this.page.evaluate(`(async() => { ${script} })()`)
		} catch (err) {
			await this.takeScreenshot(true)
			await this.saveFullHtmlContent(true)

			throw new Error(`Error on executeScript: ${err}`)
		}

		return true
	}

	downloadFile(url) {
		download(url, path.join(rootPath, defaults.downloadsFolder))
			.then(() => {
				// this.logger.notice('done downloading!')
			})
	}

	async closeBrowser(cookiesFilePath = undefined) {
		if (cookiesFilePath) await this.saveCookies(cookiesFilePath)
		else if (this.cookiesPath) await this.saveCookies(this.cookiesPath)

		await this.page.close()
		await this.browser.close()
	}

	async scrollPage(scrollCount, scrollHeight = 200) {
		try {
			for (let i = 0; i < scrollCount; i += 1) {
				// console.log(`[${i + 1}/${scrollCount}] scrolling...`)
				await this.page.evaluate((scrollHeight) => {
					window.scrollBy(0, scrollHeight || window.innerHeight)
					// window.scrollTo(0, document.body.scrollHeight)
				})

				this.cawer.sleep(3)
			}
		} catch (error) {
			throw new Error(`Error on scrollPage : ${error}`)
		}
	}

	async takeScreenshot(isError = false, pathToSave = undefined, fullPage = true) {
		try {
			const todayDate = moment()
				.format('YYYY-MM-DDTHH-mm-ss')
			const screenshotsFolderPath = path.join(rootPath, 'logs', 'screenshots')
			let pathToSaveScreenshot = pathToSave || path.join(screenshotsFolderPath, `${todayDate}.png`)

			if (isError) {
				const matches = this.url.match(/^https?:\/\/(?:www\.)?([^/?#]+)(?:[/?#]|$)/i)
				const domain = matches && matches[1]
				pathToSaveScreenshot = path.join(screenshotsFolderPath, `error_${domain}_${todayDate}.png`)
			}

			fs.ensureFileSync(pathToSaveScreenshot)
			await this.page.screenshot({
				path: pathToSaveScreenshot,
				type: 'png',
				fullPage,
			})
		} catch (err) {
			throw new Error(`Error on takeScreenshot: ${err}`)
		}
	}

	async saveFullHtmlContent(isError = false, pathToSave = undefined) {
		try {
			const todayDate = moment()
				.format('YYYY-MM-DDTHH-mm-ss')
			const screenshotsFolderPath = path.join(rootPath, 'logs', 'html')
			let pathToSaveHTML = pathToSave || path.join(screenshotsFolderPath, `${todayDate}.html`)

			const bodyHTML = await this.page.evaluate(() => document.body.innerHTML)

			if (isError) {
				const matches = this.url.match(/^https?:\/\/(?:www\.)?([^/?#]+)(?:[/?#]|$)/i)
				const domain = matches && matches[1]
				pathToSaveHTML = path.join(screenshotsFolderPath, `error_${domain}_${todayDate}.html`)
			}

			fs.ensureFileSync(pathToSaveHTML)
			fs.writeFileSync(pathToSaveHTML, bodyHTML)
		} catch (err) {
			throw new Error(`Error on saveFullHtmlContent: ${err}`)
		}
	}

	async waitForNavigation() {
		await this.page.waitForNavigation()
	}

	async waitForElement(element) {
		await this.page.waitForElement(element)
	}

	async uploadFile(fileChooserElement, filePathToUpload) {
		const [ fileChooser ] = await Promise
			.all([ this.page.waitForFileChooser(), this.page.click(fileChooserElement) ])

		await fileChooser.accept([ filePathToUpload ])
	}

}

module.exports = Spidering
