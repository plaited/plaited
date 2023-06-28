import { test, expect, beforeAll, afterAll } from'@jest/globals'
import http from 'http'
import {  findOpenPort } from '../utils.js'

const port = 3009

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Hello World\n')
})

beforeAll(() => {
  server.listen(port)
})

afterAll(() => {
  server.close()
})


test('findOpenPort', async () => {
  const actual = await findOpenPort(port)
  expect(actual >= port + 1).toBeTruthy()
})


