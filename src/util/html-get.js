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
        lookup: 100,
        connect: 200,
        secureConnect: 200,
        socket: 300,
        response: 500,
        send: 1000,
        request: 1500
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
