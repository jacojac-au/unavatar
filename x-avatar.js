#!/usr/bin/env node
'use strict'

const http = require('http')
const url = require('url')
const uniqueRandomArray = require('unique-random-array')
const got = require('got')
const cheerio = require('cheerio')

const randomCrawlerAgent = uniqueRandomArray(
  require('top-crawler-agents').filter(agent => agent.startsWith('Slackbot'))
)

const avatarUrl = str => {
  if (str?.endsWith('_200x200.jpg')) {
    str = str.replace('_200x200.jpg', '_400x400.jpg')
  }
  return str
}

const gotOpts = {
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
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
}

async function fetchXAvatar(username) {
  try {
    const response = await got(`https://x.com/${username}`, {
      ...gotOpts,
      headers: { 
        ...gotOpts.headers,
        'user-agent': randomCrawlerAgent() 
      }
    })
    
    const $ = cheerio.load(response.body)
    const avatarSrc = avatarUrl($('meta[property="og:image"]').attr('content'))
    
    // Check if it's the default X logo (common fallback)
    if (!avatarSrc || avatarSrc.includes('abs.twimg.com/sticky/default_profile_images/') || 
        avatarSrc.includes('logo-white.png') || avatarSrc.includes('default_profile')) {
      return null
    }
    
    console.log(`Found avatar for ${username}: ${avatarSrc}`)
    return avatarSrc
  } catch (error) {
    if (error.response?.statusCode === 404) {
      return null
    }
    throw new Error(`Failed to fetch avatar for ${username}: ${error.message}`)
  }
}

async function fetchImageBuffer(imageUrl) {
  const response = await got(imageUrl, { responseType: 'buffer' })
  return {
    buffer: response.body,
    contentType: response.headers['content-type'] || 'image/jpeg'
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const username = parsedUrl.query.username || pathname.slice(1)

  if (!username) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Usage: /?username=<username> or /<username>')
    return
  }

  try {
    const avatarUrl = await fetchXAvatar(username)
    
    if (!avatarUrl) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Avatar not found')
      return
    }

    const { buffer, contentType } = await fetchImageBuffer(avatarUrl)
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=3600'
    })
    res.end(buffer)
    
  } catch (error) {
    console.error(error)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
})

// Start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3001
  server.listen(PORT, () => {
    console.log(`X Avatar server running on http://localhost:${PORT}`)
    console.log('Usage: http://localhost:' + PORT + '/<username>')
    console.log('       http://localhost:' + PORT + '/?username=<username>')
  })
}

module.exports = { fetchXAvatar, server }