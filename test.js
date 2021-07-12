#!/usr/bin/env node
const { exec, spawn, spawnSync } = require('child_process')

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

const addErrorLogs = thing => {
  thing.stderr.on('data', data => {
    console.log(`stderr: ${data}`)
  })
  thing.on('error', error => {
    console.log(`stderr: ${error.message}`)
  })
}

const start = async () => {
  const ganache = spawn('npx', ['ganache-cli', '-b 1'], { cwd: '.' })
  addErrorLogs(ganache)

  const rmdata = spawnSync('rm', ['-rf', 'data'], {
    cwd: '../graph-node/docker'
  })
  console.log(rmdata.stderr.toString('utf8'), rmdata.error)

  const docker = spawn('docker-compose', ['up'], {
    cwd: '../graph-node/docker'
  })
  addErrorLogs(docker)

  const cypressOpen = spawn('yarn', ['cypress:open'], { cwd: '.' })
  addErrorLogs(cypressOpen)

  console.log('sleeping...')
  await sleep(1000 * 30)
  console.log('awake')

  const preTest = spawnSync('yarn', ['preTest'], { cwd: '.' })
  console.log(preTest.stderr.toString('utf8'), preTest.error)
  console.log('preTest')

  const subgraph = spawnSync('yarn', ['subgraph'], { cwd: '.' })
  console.log(subgraph.stderr.toString('utf8'), subgraph.error)
  console.log('subgraph')

  const setup = spawnSync('yarn', ['setup'], { cwd: '../ens-subgraph' })
  console.log(setup.stderr.toString('utf8'), setup.error)
  console.log('setup')

  const yarnStart = spawn('yarn', ['start:test'], { cwd: '.' })
  addErrorLogs(yarnStart)
  console.log('launching web app, ctrl+C to kill')

  process.on('SIGINT', () => {
    ganache.kill('SIGINT')
    docker.kill('SIGINT')
    console.log('press ctrl+C again once you see "stderr: 2"')
  })
}
start()
