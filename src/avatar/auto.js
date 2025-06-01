'use strict'

const isAbsoluteUrl = require('is-absolute-url')
const dataUriRegex = require('data-uri-regex')
const isEmail = require('is-email-like')
const pTimeout = require('p-timeout')
const urlRegex = require('url-regex')
const pAny = require('p-any')

const { providers, providersBy } = require('../providers')
const reachableUrl = require('../util/reachable-url')
const isIterable = require('../util/is-iterable')
const ExtendableError = require('../util/error')

const { STATUS_CODES } = require('http')
const { AVATAR_TIMEOUT } = require('../constant')

const is = ({ input }) => {
  if (isEmail(input)) return 'email'
  if (urlRegex({ strict: false }).test(input)) return 'domain'
  return 'username'
}

const getAvatarContent = name => async input => {
  if (typeof input !== 'string' || input === '') {
    const message =
      input === undefined ? 'not found' : `\`${input}\` is invalid`
    const statusCode = input === undefined ? 404 : 400
    throw new ExtendableError({ name, message, statusCode })
  }

  if (dataUriRegex().test(input)) {
    return { type: 'buffer', data: input }
  }

  if (!isAbsoluteUrl(input)) {
    throw new ExtendableError({
      message: 'The URL must to be absolute.',
      name,
      statusCode: 400
    })
  }

  const { statusCode, url } = await reachableUrl(input)

  if (!reachableUrl.isReachable({ statusCode })) {
    throw new ExtendableError({
      message: STATUS_CODES[statusCode],
      name,
      statusCode
    })
  }

  return { type: 'url', data: url }
}

const getAvatar = async (fn, name, args, timeout = AVATAR_TIMEOUT) => {
  const promise = Promise.resolve(fn(args))
    .then(getAvatarContent(name))
    .catch(error => {
      isIterable.forEach(error, error => {
        error.statusCode = error.statusCode ?? error.response?.statusCode
        error.name = name
      })
      throw error
    })

  return pTimeout(promise, timeout).catch(error => {
    error.name = name
    throw error
  })
}

// Fast providers that use direct URLs or simple APIs (< 200ms)
const FAST_PROVIDERS = ['gravatar', 'github', 'google', 'duckduckgo']

// Medium providers that use external APIs (200-800ms)  
const MEDIUM_PROVIDERS = ['microlink']

// Slow providers that use web scraping (1-10s)
const SLOW_PROVIDERS = ['x', 'youtube', 'dribbble', 'telegram', 'soundcloud', 'deviantart', 'gitlab', 'readcv', 'substack', 'twitch', 'onlyfans']

module.exports = async args => {
  const collection = providersBy[is(args)]
  
  // Try fast providers first (200ms timeout)
  const fastProviders = collection.filter(name => FAST_PROVIDERS.includes(name))
  if (fastProviders.length > 0) {
    try {
      const fastPromises = fastProviders.map(name =>
        getAvatar(providers[name], name, args, 200)
      )
      return await pAny(fastPromises)
    } catch (error) {
      // Continue to medium providers if all fast providers fail
    }
  }
  
  // Try medium providers (800ms timeout)
  const mediumProviders = collection.filter(name => MEDIUM_PROVIDERS.includes(name))
  if (mediumProviders.length > 0) {
    try {
      const mediumPromises = mediumProviders.map(name =>
        getAvatar(providers[name], name, args, 800)
      )
      return await pAny(mediumPromises)
    } catch (error) {
      // Continue to slow providers if medium providers fail
    }
  }
  
  // Finally try slow providers (much reduced timeout)
  const slowProviders = collection.filter(name => SLOW_PROVIDERS.includes(name))
  const slowPromises = slowProviders.map(name =>
    getAvatar(providers[name], name, args, 2000)
  )
  return pAny(slowPromises)
}

module.exports.getAvatar = getAvatar
