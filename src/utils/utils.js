import { getNetworkId } from '@ensdomains/ui/src/web3'
import {
  emptyAddress as _emptyAddress,
  validateName as _validateName,
  parseSearchTerm as _parseSearchTerm,
  getEnsStartBlock as _ensStartBlock,
  isLabelValid as _isLabelValid,
  isEncodedLabelhash
} from '@ensdomains/ui/src/utils/index'
import { validate } from '@ensdomains/ens-validation'

import getENS from '../api/ens'
import * as jsSHA3 from 'js-sha3'
import { saveName } from '../api/labels'
import { setup } from '../api/ens'
import { SET_ERROR } from 'graphql/mutations'
import { setupClient } from 'apolloClient'
import { connect } from '../api/web3modal'
import { safeInfo, setupSafeApp } from './safeApps'

// From https://github.com/0xProject/0x-monorepo/blob/development/packages/utils/src/address_utils.ts

const BASIC_ADDRESS_REGEX = /^(0x)?[0-9a-f]{40}$/i
const SAME_CASE_ADDRESS_REGEX = /^(0x)?([0-9a-f]{40}|[0-9A-F]{40})$/
const ADDRESS_LENGTH = 40
export const ROPSTEN_DNSREGISTRAR_ADDRESS =
  '0x475e527d54b91b0b011DA573C69Ac54B2eC269ea'

export const addressUtils = {
  isChecksumAddress(address) {
    // Check each case
    const unprefixedAddress = address.replace('0x', '')
    const addressHash = jsSHA3.keccak256(unprefixedAddress.toLowerCase())

    for (let i = 0; i < ADDRESS_LENGTH; i++) {
      // The nth letter should be uppercase if the nth digit of casemap is 1
      const hexBase = 16
      const lowercaseRange = 7
      if (
        (parseInt(addressHash[i], hexBase) > lowercaseRange &&
          unprefixedAddress[i].toUpperCase() !== unprefixedAddress[i]) ||
        (parseInt(addressHash[i], hexBase) <= lowercaseRange &&
          unprefixedAddress[i].toLowerCase() !== unprefixedAddress[i])
      ) {
        return false
      }
    }
    return true
  },
  isAddress(address) {
    if (!BASIC_ADDRESS_REGEX.test(address)) {
      // Check if it has the basic requirements of an address
      return false
    } else if (SAME_CASE_ADDRESS_REGEX.test(address)) {
      // If it's all small caps or all all caps, return true
      return true
    } else {
      // Otherwise check each case
      const isValidChecksummedAddress = addressUtils.isChecksumAddress(address)
      return isValidChecksummedAddress
    }
  }
}

export const uniq = (a, param) =>
  a.filter(
    (item, pos) => a.map(mapItem => mapItem[param]).indexOf(item[param]) === pos
  )

export async function getEtherScanAddr() {
  const networkId = await getNetworkId()
  switch (networkId) {
    case 1:
    case '1':
      return 'https://etherscan.io/'
    case 3:
    case '3':
      return 'https://ropsten.etherscan.io/'
    case 4:
    case '4':
      return 'https://rinkeby.etherscan.io/'
    default:
      return 'https://etherscan.io/'
  }
}

export async function ensStartBlock() {
  return _ensStartBlock()
}

export const checkLabels = (...labelHashes) => labelHashes.map(hash => null)

// export const checkLabels = (...labelHashes) =>
//   labelHashes.map(labelHash => checkLabelHash(labelHash) || null)

export const mergeLabels = (labels1, labels2) =>
  labels1.map((label, index) => (label ? label : labels2[index]))

export function validateName(name) {
  const normalisedName = _validateName(name)
  saveName(normalisedName)
  return normalisedName
}

export function isLabelValid(name) {
  return _isLabelValid(name)
}

export const parseSearchTerm = async term => {
  const ens = getENS()
  const domains = term.split('.')
  const tld = domains[domains.length - 1]
  try {
    _validateName(tld)
  } catch (e) {
    return 'invalid'
  }
  console.log('** parseSearchTerm', { ens })
  const address = await ens.getOwner(tld)
  return _parseSearchTerm(term, true)
}

export function humaniseName(name) {
  return name
    .split('.')
    .map(label => {
      return isEncodedLabelhash(label) ? `[unknown${label.slice(1, 8)}]` : label
    })
    .join('.')
}

export function modulate(value, rangeA, rangeB, limit) {
  let fromHigh, fromLow, result, toHigh, toLow
  if (limit === null) {
    limit = false
  }
  fromLow = rangeA[0]
  fromHigh = rangeA[1]
  toLow = rangeB[0]
  toHigh = rangeB[1]
  result = toLow + ((value - fromLow) / (fromHigh - fromLow)) * (toHigh - toLow)
  if (limit === true) {
    if (toLow < toHigh) {
      if (result < toLow) {
        return toLow
      }
      if (result > toHigh) {
        return toHigh
      }
    } else {
      if (result > toLow) {
        return toLow
      }
      if (result < toHigh) {
        return toHigh
      }
    }
  }
  return result
}

export function isElementInViewport(el) {
  var rect = el.getBoundingClientRect()

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight ||
        document.documentElement.clientHeight) /*or $(window).height() */ &&
    rect.right <=
      (window.innerWidth ||
        document.documentElement.clientWidth) /*or $(window).width() */
  )
}

export const emptyAddress = _emptyAddress

export function isShortName(term) {
  return [...term].length < 3
}

export const aboutPageURL = () => {
  const lang = window.localStorage.getItem('language') || ''

  return `https://ens.domains/${lang === 'en' ? '' : lang}`
}

export function isRecordEmpty(value) {
  return value === emptyAddress || value === ''
}

export async function handleNetworkChange() {
  let client, networkId
  try {
    if (
      process.env.REACT_APP_STAGE === 'local' &&
      process.env.REACT_APP_ENS_ADDRESS
    ) {
      await setup({
        reloadOnAccountsChange: true,
        customProvider: 'http://localhost:8545',
        ensAddress: process.env.REACT_APP_ENS_ADDRESS
      })
      let labels = window.localStorage['labels']
        ? JSON.parse(window.localStorage['labels'])
        : {}
      window.localStorage.setItem(
        'labels',
        JSON.stringify({
          ...labels,
          ...JSON.parse(process.env.REACT_APP_LABELS)
        })
      )
    } else {
      const safe = await safeInfo()
      if (safe) {
        const network = await setupSafeApp(safe)
      } else if (window.localStorage.getItem('WEB3_CONNECT_CACHED_PROVIDER')) {
        const network = await connect()
      } else {
        await setup({
          reloadOnAccountsChange: false,
          enforceReadOnly: true,
          enforceReload: true
        })
      }
    }
    networkId = await getNetworkId()
    client = await setupClient(networkId)
  } catch (e) {
    networkId = networkId || 1 // Readonly to Mainnet
    client = await setupClient()
    await client.mutate({
      mutation: SET_ERROR,
      variables: { message: e && e.message }
    })
  }
  return { client, networkId }
}

export const hasValidReverseRecord = getReverseRecord =>
  getReverseRecord?.name && getReverseRecord.name !== emptyAddress

export const hasNonAscii = () => {
  const strs = window.location.pathname.split('/')
  const rslt = strs.reduce((accum, next) => {
    if (accum) return true
    if (!validate(next)) return true
    return accum
  }, false)
  return rslt
}
