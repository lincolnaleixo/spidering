/* eslint-disable require-jsdoc */
const fs = require('fs')
const dirname = '.'
const Sentry = require('@sentry/node')
const Logering = require('logering')
// const ignoreDir = [
// 	'node_modules',
// 	'.vscode',
// 	'meta',
// ]
// const ignoreFiles = [
// 	'.eslintrc',
// 	'.vscode',
// 	'meta',
// ]
const includeFileExtensions = [ '.js' ]
const includeDir = [ 'src' ]
// const ignoreExtension = [ '.md' ]
const path = require('path') // require node path module (a couple of tools for reading path names)
const Logger = new Logering('spidering')
const log = Logger.get()

async function readFiles() {
	let filteredFilesNames
	const fileNames = fs.readdirSync(dirname)
	// for (let i = 0; i < filesNames.length; i += 1) {
	//     const fileName = filesNames[i]
	//     if(ignoreDir.)
	// }
	// TODO colocar recursividade (ter parametro para ate qual nivel de recursividade)
	filteredFilesNames = fileNames.filter((fileName) => includeDir.includes(fileName))
	filteredFilesNames = filteredFilesNames.filter((fileName) => includeFileExtensions.indexOf(path.extname(fileName)))
	for (let i = 0; i < filteredFilesNames.length; i += 1) {
		log.info(fs.lstatSync(filteredFilesNames[i]).isDirectory())
	}
	Sentry.init({ dsn: 'https://e5bf86d2c2be4d82bb4429b29cb8796e@o396302.ingest.sentry.io/5249454' })
	// myUndefinedFunction()

	// for (let i = 0; i < fileNames.length; i += 1) {
	// 	const extName = path.extname(fileNames)

	// 	return extName === `.${extFilter}`
	// }
	log.error(filteredFilesNames)
	Sentry.captureMessage('Something went wrong')
}

(async () => {
	await readFiles()
})()
// VARIABLES: version, git tokens et

// TODO -> issues
// issues <-> clickup tasks
//* create changelogs:
// usar o template https://github.com/skywinder/ActionSheetPicker-3.0/blob/develop/CHANGELOG.md + https://github.com/eslint/eslint/releases
// pegar o nome da task do github issue ou clickup task (melhor)
// push to all gits (usar fork)
// create releases all gits e pegar o ultimo changelog para colocar no release
// publish to npm and github packages
// publish to docker registry gitlab and github
