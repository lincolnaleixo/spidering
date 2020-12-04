const Cawer = require('cawer')
// const puppeteer = require('puppeteer-extra')
const Spider = require('../src/spidering');

(async () => {
	const url = 'https://uppy.io/examples/xhrupload/'
	// const proxy = 'socks5://167.172.101.11:3129'
	const cawer = new Cawer()
	const spider = new Spider()
	await spider.createBrowser({
		slowMo: 2000, headless: false,
	})
	// await spider.createBrowser()
	await spider.createPage('clean')
	await spider.navigateTo(url)
	await spider.scrollPage(10)
	// await spider.uploadFile('.uppy-FileInput-btn', '/Users/robot/WebstormProjects/youtube-upload/test1.mov')

	await spider.closeBrowser()
})()
