/* eslint-disable max-lines-per-function */
// const puppeteer = require('puppeteer')
// const ProxyLists = require('proxy-lists')
// const fetch = require('node-fetch')
const Spider = require('../src/spidering');

(async () => {
	const pageType = 'clean'
	const spider = new Spider()
	const url = 'https://www.amazon.com/'
	let response = ''
	await spider.createBrowser()
	await spider.createPage(pageType)
	await spider.navigateTo(url)
	response = await spider.scrape({ script: 'document.querySelector("#twotabsearchtextbox").name' })
	console.log(`Using pupetter:${response}`)
	await spider.closeBrowser()

	response = await spider.scrape({
		element: '#twotabsearchtextbox', url,
	})
	console.log(`Using axios:${response.attr('name')}`)
})()
