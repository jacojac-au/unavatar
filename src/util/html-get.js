'use strict'

const getHTML = require('html-get')

const createBrowser = require('./browserless')
const { gotOpts } = require('./got')

const { AVATAR_TIMEOUT } = require('../constant')

module.exports = async (url, { puppeteerOpts, ...opts } = {}) => {
  const browser = await createBrowser()
  const browserContext = await browser.createContext()

  const result = await getHTML(url, {
    prerender: false,
    cache: false,
    ...opts,
    getBrowserless: () => browserContext,
    serializeHtml: $ => ({ $ }),
    puppeteerOpts: {
      timeout: AVATAR_TIMEOUT,
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor', '--no-sandbox', '--disable-dev-shm-usage', '--disable-http-cache', '--disable-application-cache'],
      ...puppeteerOpts
    },
    gotOpts: {
      ...gotOpts,
      timeout: AVATAR_TIMEOUT,
      cache: false,
      headers: {
        ...gotOpts.headers,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }
  })

  await Promise.resolve(browserContext).then(browserless =>
    browserless.destroyContext()
  )

  return result
}
