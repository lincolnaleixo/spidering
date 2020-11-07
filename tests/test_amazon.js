const Cawer = require('cawer')
// const puppeteer = require('puppeteer-extra')
const jsonfile = require('jsonfile')
const path = require('path')
const Spider = require('../src/spidering')
const rootPath = path.join(__dirname)
const testOptions = jsonfile.readFileSync(path.join(rootPath, 'testsOptions.json'));

(async () => {
	const url = 'https://www.whatismybrowser.com/detect/what-is-my-user-agent'
	// const proxy = 'socks5://167.172.101.11:3129'
	const cawer = new Cawer()
	const spider = new Spider()
	await spider.createBrowser({
		blockAds: false, testOptions,
	})
	// await spider.createBrowser()
	await spider.createPage('clean')
	await spider.navigateTo(url)
	await spider.takeScreenshot(true, './screen.jpg')
	await spider.closeBrowser()
})()
