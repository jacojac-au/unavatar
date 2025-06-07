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
      timeout: 1500,
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor', '--no-sandbox', '--disable-dev-shm-usage', '--disable-http-cache', '--disable-application-cache'],
      ...puppeteerOpts
    },
    gotOpts: {
      ...gotOpts,
      timeout: {
        lookup: 1000,
        connect: 3000,
        secureConnect: 3000,
        socket: 2000,
        response: 2000,
        send: 2000,
        request: 5000
      },
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
