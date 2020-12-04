const Cawer = require('cawer')
// const puppeteer = require('puppeteer-extra')
const Spider = require('../src/spidering');

(async () => {
	const url = 'https://www.whatismybrowser.com/detect/what-is-my-user-agent'
	// const proxy = 'socks5://167.172.101.11:3129'
	const cawer = new Cawer()
	const spider = new Spider()
	await spider.createBrowser()
	// await spider.createBrowser()
	await spider.createPage('clean')
	await spider.navigateTo(url)
	await spider.saveFullHtmlContent(true)
	await spider.closeBrowser()
})()
