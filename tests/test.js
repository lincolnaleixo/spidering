/* eslint-disable max-lines-per-function */
// const puppeteer = require('puppeteer')
// const ProxyLists = require('proxy-lists')
// const fetch = require('node-fetch')
const Spider = require('../src/spidering');

(async () => {
	// const response = await fetch('https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list.txt')
	// console.log(response.json())
	// const options = {
	// 	// options
	// 	countries: [ 'us' ],
	// 	protocols: [ 'socks5' ],
	// }
	//
	// // `getProxies` returns an event emitter.
	// let proxiesToUse
	// ProxyLists.getProxies()
	// 	.on('data', (proxies) => {
	//
	// 		// Received some proxies.
	// 		console.log('got some proxies')
	//
	// 		proxiesToUse = proxies
	//
	// 	})
	// 	.on('error', (error) => {
	//
	// 		// Some error has occurred.
	// 		console.log('error!', error)
	//
	// 	})
	// 	.once('end', () => {
	//
	// 		// Done getting proxies.
	// 		console.log('end!')
	//
	// 	})
	//
	// console.log(proxiesToUse)
	const pageType = 'clean'
	const spider = new Spider()
	// const proxy = 'socks4://24.172.225.122:3629'
	const url = 'https://www.amazon.com/'
	// const elementId = 'twotabsearchtextbox'
	// const response = await spider.scrapeElement(url, elementId)
	// console.log(response)

	await spider.createBrowser()
	await spider.createPage(pageType)
	await spider.navigateTo(url)
	await spider.evaluate('elementToEvaluate', '123')

	// await spider.typeInput('input[name="q"]', 'testing', 4000)
	// await spider.navigateTo('https://intoli.com/blog/not-possible-to-block-chrome-headless/chrome-headless-test.html')

	// const userAgent = spider.getRandomUserAgent()

	// const { parse } = useragent
	// const userA = new UserAgent({ deviceCategory: 'desktop' }, (data) => {
	//
	// 	// console.log(parse(data.userAgent));
	// 	const ua = parse(data.userAgent)
	//
	// 	// const os = parse(data.userAgent).os;
	// 	// return os.family === 'Mac OS X' && parseInt(os.major, 10) > 11;
	// 	return ua.family === 'Chrome' && ua.major > 75
	//
	// })
	// console.log(userAgent)
	await spider.closeBrowser()
})()
