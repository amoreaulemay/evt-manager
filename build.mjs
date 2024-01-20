import * as esbuild from 'esbuild'

await (async function() {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outdir: 'dist',
  })
})()
