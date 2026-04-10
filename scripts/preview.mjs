import { preview } from 'vite'

const previewServer = await preview({
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})
previewServer.printUrls()
