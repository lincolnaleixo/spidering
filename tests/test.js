/* eslint-disable prefer-destructuring */
/* eslint-disable max-lines-per-function */
// const puppeteer = require('puppeteer')
// const ProxyLists = require('proxy-lists')
// const fetch = require('node-fetch')

const Spider = require('../src/spidering');

(async () => {
	let response
	let pageType
	let url
	let script // 'document.querySelector("#twotabsearchtextbox").name'
	let element // '#twotabsearchtextbox'
	if (process.argv.find((item) => item === '--nodeEnv')) {
		process.env.NODE_ENV = process.argv[process.argv.findIndex((item) => item === '--nodeEnv') + 1]
	} else {
		process.env.NODE_ENV = 'PRODUCTION'
		console.log('Using default NODE_ENV PRODUCTION')
	}
	if (process.argv.find((item) => item === '--pageType')) {
		pageType = process.argv[process.argv.findIndex((item) => item === '--pageType') + 1]
	} else {
		pageType = 'full'
		console.log('Using default pageType full')
	}
	if (process.argv.find((item) => item === '--url')) {
		url = process.argv[process.argv.findIndex((item) => item === '--url') + 1]
	} else {
		url = 'https://www.amazon.com'
		console.log('Using default url Amazon.com')
	}

	const spider = new Spider()

	if (process.argv.find((item) => item === '--script')) {
		script = process.argv[process.argv.findIndex((item) => item === '--script') + 1]
		await spider.createBrowser()
		await spider.createPage(pageType)
		await spider.navigateTo(url)
		response = await spider.scrape({ script })
		console.log(`Response using pupetter: ${response}`)
		await spider.closeBrowser()

		return
	}
	console.log('No script set')

	if (process.argv.find((item) => item === '--element')) {
		element = process.argv[process.argv.findIndex((item) => item === '--element') + 1]
		response = await spider.scrape({
			element, url,
		})
		console.log(`Response using axios: ${response.attr('name')}`)
	} else {
		console.log('No element set')
	}
})()
