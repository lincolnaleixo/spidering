const Cawer = require('cawer')
// const puppeteer = require('puppeteer-extra')
const jsonfile = require('jsonfile')
const path = require('path')
const Spider = require('../src/spidering')
const rootPath = path.join(__dirname)
const testOptions = jsonfile.readFileSync(path.join(rootPath, 'testsOptions.json'));

(async () => {
	const url = 'http://amazon.com'
	// const endpointServer = '10.0.0.48:4000'
	const cawer = new Cawer()
	// Replace puppeteer.launch with puppeteer.connect
	// const browser = await puppeteer.connect({ browserWSEndpoint: `ws://${enpointServer}` })
	// // Everything else stays the same
	// const page = await browser.newPage()
	// await page.goto(url)
	// await page.screenshot({ path: 'screenshot.png' })
	// browser.close()
	// await spider.createBrowser()
	// await spider.createPage()
	// await spider.navigateTo(url)
	// await cawer.sleep(3)
	// await spider.closeBrowser()
	// const browser = await puppeteer.connect({
	// 	browserWSEndpoint: 'ws://10.0.0.48:4000', ignoreHTTPSErrors: true,
	// })
	// await spider.closeBrowser()
	// await page.goto(url)
	const spider = new Spider()
	await spider.createBrowser({ endpointServer: testOptions.endpointServer })
	// await spider.createBrowser()
	await spider.createPage('clean')
	await spider.navigateTo(url)
	await cawer.sleep(3)
	await spider.takeScreenshot(false, 'screenshot.png')
	await spider.closeBrowser()
})()
