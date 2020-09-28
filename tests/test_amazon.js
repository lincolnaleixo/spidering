const Cawer = require('cawer')
// const puppeteer = require('puppeteer-extra')
const jsonfile = require('jsonfile')
const path = require('path')
const Spider = require('../src/spidering')
const rootPath = path.join(__dirname)
const testOptions = jsonfile.readFileSync(path.join(rootPath, 'testsOptions.json'));

(async () => {
	const url = 'http://www.amazon.com'
	// const endpointServer = '10.0.0.48:4000'
	const cawer = new Cawer()
	const spider = new Spider()
	await spider.createBrowser({
		endpointServer: testOptions.endpointServer, blockAds: false,
	})
	// await spider.createBrowser()
	await spider.createPage('clean')
	console.log(await spider.navigateTo(url))
	await cawer.sleep(3)
	await spider.takeScreenshot(false, 'screenshot.png')
	await spider.closeBrowser()
})()
