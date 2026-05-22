import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';
import { execFile } from 'child_process';

export default defineConfig({
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }),
    tsconfigPaths(),
    {
      name: '17track-proxy',
      configureServer(server) {
        const memOrders: Map<string, any> = new Map()
        const jsonHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

        server.middlewares.use('/api/orders', (req, res) => {
          if (req.method === 'OPTIONS') {
            res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
            res.end()
            return
          }
          const url = new URL(req.url || '/', 'http://localhost')

          if (req.method === 'GET' && url.pathname === '/api/orders/count') {
            res.writeHead(200, jsonHeaders)
            res.end(JSON.stringify({ success: true, total: memOrders.size }))
            return
          }
          if (req.method === 'GET' && url.pathname === '/api/orders/filters') {
            const cs = new Set<string>(), crs = new Set<string>(), ws = new Set<string>(), ts = new Set<string>()
            memOrders.forEach((o: any) => {
              if (o.destinationCountry) cs.add(o.destinationCountry)
              if (o.carrier) crs.add(o.carrier)
              if (o.erpWarehouse) ws.add(o.erpWarehouse)
              if (o.erpTeam) ts.add(o.erpTeam)
            })
            res.writeHead(200, jsonHeaders)
            res.end(JSON.stringify({ success: true, countries: [...cs], carriers: [...crs], warehouses: [...ws], teams: [...ts], statuses: [] }))
            return
          }
          if (req.method === 'GET' && url.pathname === '/api/orders') {
            const all = [...memOrders.values()]
            res.writeHead(200, jsonHeaders)
            res.end(JSON.stringify({ success: true, orders: all, total: all.length, limit: 5000, offset: 0 }))
            return
          }
          if (req.method === 'POST' && url.pathname === '/api/orders') {
            const chunks: Buffer[] = []
            req.on('data', (c: Buffer) => chunks.push(c))
            req.on('end', () => {
              try {
                const body = JSON.parse(Buffer.concat(chunks).toString())
                const orders = body.orders || []
                orders.forEach((o: any) => memOrders.set(o.id || o.orderId, o))
                res.writeHead(200, jsonHeaders)
                res.end(JSON.stringify({ success: true, upserted: orders.length }))
              } catch {
                res.writeHead(400, jsonHeaders)
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }))
              }
            })
            return
          }
          if (req.method === 'DELETE' && url.pathname === '/api/orders/clear') {
            memOrders.clear()
            res.writeHead(200, jsonHeaders)
            res.end(JSON.stringify({ success: true }))
            return
          }
          if (req.method === 'DELETE' && url.pathname.startsWith('/api/orders/')) {
            const id = url.pathname.replace('/api/orders/', '')
            memOrders.delete(id)
            res.writeHead(200, jsonHeaders)
            res.end(JSON.stringify({ success: true }))
            return
          }
          res.writeHead(404, jsonHeaders)
          res.end(JSON.stringify({ success: false, error: 'Not found' }))
        })

        server.middlewares.use('/api/erp', (req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ orders: [] }))
        })
        server.middlewares.use('/api/17track/test', (req, res) => {
          if (req.method === 'OPTIONS') {
            res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, 17token' })
            res.end()
            return
          }
          const token = req.headers['17token'] as string
          if (!token) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, message: '请先配置API密钥' }))
            return
          }
          const args = [
            '-s', '-w', '\n__HTTP_CODE__%{http_code}',
            '-X', 'POST',
            'https://api.17track.net/track/v2.4/getquota',
            '--connect-timeout', '15', '--max-time', '30',
            '-H', 'Content-Type: application/json',
            '-H', `17token: ${token}`,
            '-d', '[]',
          ]
          execFile('curl', args, { maxBuffer: 5 * 1024 * 1024 }, (err, stdout) => {
            if (err) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, message: err.message }))
              return
            }
            const sep = '__HTTP_CODE__'
            const idx = stdout.lastIndexOf(sep)
            let httpCode = 502
            let responseBody = stdout
            if (idx !== -1) {
              httpCode = parseInt(stdout.slice(idx + sep.length), 10) || 502
              responseBody = stdout.slice(0, idx)
            }
            try {
              const data = JSON.parse(responseBody)
              if (httpCode === 401) {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, message: 'API密钥无效或未授权' }))
              } else if (data.code === 0) {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, message: '连接成功', quota: data.data }))
              } else if (data.data?.errors?.length) {
                const msg = data.data.errors.map((e: any) => e.message).join('; ')
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, message: msg }))
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, message: `未知响应: code ${data.code}` }))
              }
            } catch {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, message: `连接失败: HTTP ${httpCode}` }))
            }
          })
        })
        server.middlewares.use('/api/17track', (req, res) => {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', () => {
            const body = Buffer.concat(chunks).toString()
            const targetPath = req.url || ''
            const url = `https://api.17track.net${targetPath}`

            const forwardHeaders = ['17token', 'content-type']
            const curlHeaders: string[] = []
            for (const h of forwardHeaders) {
              const val = req.headers[h]
              if (val) {
                curlHeaders.push('-H', `${h}: ${val}`)
              }
            }

            const args = [
              '-s',
              '-w', '\n__HTTP_CODE__%{http_code}',
              '-X', req.method || 'POST',
              url,
              '--connect-timeout', '15',
              '--max-time', '30',
              ...curlHeaders,
            ]
            if (body) {
              args.push('-d', body)
            }

            execFile('curl', args, { maxBuffer: 5 * 1024 * 1024 }, (err, stdout) => {
              if (err) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ code: -1, msg: err.message }))
                return
              }
              const sep = '__HTTP_CODE__'
              const idx = stdout.lastIndexOf(sep)
              let httpCode = 502
              let responseBody = stdout
              if (idx !== -1) {
                httpCode = parseInt(stdout.slice(idx + sep.length), 10) || 502
                responseBody = stdout.slice(0, idx)
              }
              res.writeHead(httpCode, { 'Content-Type': 'application/json' })
              res.end(responseBody)
            })
          })
          req.on('error', () => {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ code: -1, msg: 'Request read error' }))
          })
        })
      },
    },
  ],
})
