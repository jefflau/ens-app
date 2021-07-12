import {
  isDecrypted,
  getBlock,
  getWeb3,
  getNetworkId,
  getNamehash,
  getSigner,
  getResolverContract,
  getOldResolverContract,
  encodeContenthash,
  getProvider,
  labelhash,
  utils
} from '@ensdomains/ui'
import { formatsByName } from '@ensdomains/address-encoder'
import isEqual from 'lodash/isEqual'
import modeNames from '../modes'
import { sendHelper, sendHelperArray } from '../resolverUtils'
import { emptyAddress, ROPSTEN_DNSREGISTRAR_ADDRESS } from '../../utils/utils'
import TEXT_RECORD_KEYS from 'constants/textRecords'
import COIN_LIST_KEYS from 'constants/coinList'
import {
  GET_FAVOURITES,
  GET_SUBDOMAIN_FAVOURITES,
  GET_ALL_NODES,
  GET_REGISTRANT_FROM_SUBGRAPH
} from '../../graphql/queries'
import getClient from '../../apolloClient'
import getENS, { getRegistrar } from 'api/ens'
import { normalize } from 'eth-ens-namehash'

let savedFavourites =
  JSON.parse(window.localStorage.getItem('ensFavourites')) || []
let savedSubDomainFavourites =
  JSON.parse(window.localStorage.getItem('ensSubDomainFavourites')) || []
const defaults = {
  names: [],
  favourites: savedFavourites,
  subDomainFavourites: savedSubDomainFavourites,
  transactionHistory: []
}

async function delay(ms) {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

async function getParent(name) {
  const ens = getENS()
  const nameArray = name.split('.')
  if (nameArray.length < 1) {
    return [null, null]
  }
  nameArray.shift()
  const parent = nameArray.join('.')
  const parentOwner = await ens.getOwner(parent)
  return [parent, parentOwner]
}

async function getRegistrarEntry(name) {
  const registrar = getRegistrar()
  const nameArray = name.split('.')
  if (nameArray.length > 3 || nameArray[1] !== 'eth') {
    return {}
  }

  const entry = await registrar.getEntry(nameArray[0])
  const {
    registrant,
    deedOwner,
    state,
    registrationDate,
    migrationStartDate,
    currentBlockDate,
    transferEndDate,
    gracePeriodEndDate,
    revealDate,
    value,
    highestBid,
    expiryTime,
    isNewRegistrar,
    available
  } = entry

  const node = {
    name: `${name}`,
    state: modeNames[state],
    stateError: null, // This is only used for dnssec errors
    registrationDate,
    gracePeriodEndDate: gracePeriodEndDate || null,
    migrationStartDate: migrationStartDate || null,
    currentBlockDate: currentBlockDate || null,
    transferEndDate: transferEndDate || null,
    revealDate,
    value,
    highestBid,
    registrant,
    deedOwner,
    isNewRegistrar: !!isNewRegistrar,
    available,
    expiryTime: expiryTime || null
  }

  return node
}

async function getDNSEntryDetails(name) {
  const ens = getENS()
  const registrar = getRegistrar()
  const nameArray = name.split('.')
  const networkId = await getNetworkId()
  if (nameArray.length !== 2 || nameArray[1] === 'eth') return {}

  let tld = nameArray[1]
  let owner
  let tldowner
  tldowner = (await ens.getOwner(tld)).toLocaleLowerCase()
  if (parseInt(tldowner) === 0 && networkId === 3) {
    tldowner = ROPSTEN_DNSREGISTRAR_ADDRESS
  }

  try {
    owner = (await ens.getOwner(name)).toLocaleLowerCase()
  } catch {
    return {}
  }

  let isDNSRegistrarSupported = await registrar.isDNSRegistrar(tldowner)
  if (isDNSRegistrarSupported && tldowner !== emptyAddress) {
    const dnsEntry = await registrar.getDNSEntry(name, tldowner, owner)
    const node = {
      isDNSRegistrar: true,
      dnsOwner: dnsEntry.claim?.result
        ? dnsEntry.claim.getOwner()
        : emptyAddress,
      state: dnsEntry.state,
      stateError: dnsEntry.stateError,
      parentOwner: tldowner
    }

    return node
  }
}

async function getTestEntry(name) {
  const registrar = getRegistrar()
  const nameArray = name.split('.')
  if (nameArray.length < 3 && nameArray[1] === 'test') {
    const expiryTime = await registrar.expiryTimes(nameArray[0])
    if (expiryTime) return { expiryTime }
  }
  return {}
}

async function getRegistrant(name) {
  const client = getClient()
  try {
    const { data, error } = await client.query({
      query: GET_REGISTRANT_FROM_SUBGRAPH,
      fetchPolicy: 'network-only',
      variables: { id: labelhash(name.split('.')[0]) }
    })
    if (!data || !data.registration) {
      return null
    }
    if (error) {
      console.log('Error getting registrant from subgraph', error)
      return null
    }

    return utils.getAddress(data.registration.registrant.id)
  } catch (e) {
    console.log('GraphQL error from getRegistrant', e)
    return null
  }
}

function adjustForShortNames(node) {
  const nameArray = node.name.split('.')
  const { label, parent } = node

  // return original node if is subdomain or not eth
  if (nameArray.length > 2 || parent !== 'eth' || label.length > 6) return node

  //if the auctions are over
  if (new Date() > new Date(1570924800000)) {
    return node
  }

  let auctionEnds
  let onAuction = true

  if (label.length >= 5) {
    auctionEnds = new Date(1569715200000) // 29 September
  } else if (label.length >= 4) {
    auctionEnds = new Date(1570320000000) // 6 October
  } else if (label.length >= 3) {
    auctionEnds = new Date(1570924800000) // 13 October
  }

  if (new Date() > auctionEnds) {
    onAuction = false
  }

  return {
    ...node,
    auctionEnds,
    onAuction,
    state: onAuction ? 'Auction' : node.state
  }
}

function setState(node) {
  let state = node.state
  if (node.isDNSRegistrar) {
    return node
  }
  if (node.available) {
    state = 'Open'
  } else {
    state = 'Owned'
  }
  return {
    ...node,
    state
  }
}

const handleSingleTransaction = async (name, record, resolverInstance) => {
  const namehash = getNamehash(name)

  if (record.contractFn === 'setContenthash') {
    const contentTx = await resolverInstance[record.contractFn](
      namehash,
      encodeContenthash(record.value || emptyAddress)?.encoded
    )
    return sendHelper(contentTx)
  }

  if (record.contractFn === 'setText') {
    const textRecordTx = await resolverInstance[record.contractFn](
      namehash,
      record.key,
      record.value
    )
    return sendHelper(textRecordTx)
  }

  if (record.contractFn === 'setAddr(bytes32,uint256,bytes)') {
    const coinRecord = record
    const { decoder, coinType } = formatsByName[coinRecord.key]
    let addressAsBytes

    // use 0x00... for ETH because an empty string throws
    if (coinRecord.key === 'ETH' && coinRecord.value === '') {
      coinRecord.value = emptyAddress
    }

    if (!coinRecord.value || coinRecord.value === '') {
      addressAsBytes = Buffer.from('')
    } else {
      addressAsBytes = decoder(coinRecord.value)
    }

    const coinRecordTx = await resolverInstance[record.contractFn](
      namehash,
      coinType,
      addressAsBytes
    )

    return sendHelper(coinRecordTx)
  }

  console.error('Single transaction error')
}

const handleMultipleTransactions = async (name, records, resolverInstance) => {
  try {
    const resolver = resolverInstance.interface
    const namehash = getNamehash(name)

    const transactionArray = records.map(record => {
      if (record.contractFn === 'setContenthash') {
        const encodedContenthash = encodeContenthash(record.value)?.encoded
        return resolver.encodeFunctionData(record.contractFn, [
          namehash,
          encodedContenthash
        ])
      }

      if (record.contractFn === 'setText') {
        return resolver.encodeFunctionData(record.contractFn, [
          namehash,
          record.key,
          record.value
        ])
      }

      if (record.contractFn === 'setAddr(bytes32,uint256,bytes)') {
        const { decoder, coinType } = formatsByName[record.key]
        let addressAsBytes
        // use 0x00... for ETH because an empty string throws
        if (record.key === 'ETH' && record.value === '') {
          record.value = emptyAddress
        }
        if (!record.value || record.value === '') {
          addressAsBytes = Buffer.from('')
        } else {
          addressAsBytes = decoder(record.value)
        }
        return resolver.encodeFunctionData(record.contractFn, [
          namehash,
          coinType,
          addressAsBytes
        ])
      }
    })

    // flatten textrecords and addresses and remove undefined
    //transactionArray.flat().filter(bytes => bytes)
    //add them all together into one transaction
    const tx1 = await resolverInstance.multicall(transactionArray)
    return sendHelper(tx1)
  } catch (e) {
    console.log('error creating transaction array', e)
  }
}

const resolvers = {
  Query: {
    getOwner: async (_, { name }, { cache }) => {
      const ens = getENS()
      const owner = await ens.getOwner(name)
      return owner
    },

    singleName: async (_, { name }, { cache }) => {
      try {
        const ens = getENS()
        const decrypted = isDecrypted(name)
        let node = {
          name: null,
          revealDate: null,
          registrationDate: null,
          migrationStartDate: null,
          currentBlockDate: null,
          transferEndDate: null,
          gracePeriodEndDate: null,
          value: null,
          highestBid: null,
          state: null,
          stateError: null,
          label: null,
          decrypted,
          price: null,
          rent: null,
          referralFeePPM: null,
          available: null,
          contentType: null,
          expiryTime: null,
          isNewRegistrar: null,
          isDNSRegistrar: null,
          dnsOwner: null,
          deedOwner: null,
          registrant: null,
          auctionEnds: null // remove when auction is over
        }
        const dataSources = [
          getRegistrarEntry(name),
          ens.getDomainDetails(name),
          getParent(name),
          getDNSEntryDetails(name),
          getTestEntry(name),
          getRegistrant(name)
        ]

        const [
          registrarEntry,
          domainDetails,
          [parent, parentOwner],
          dnsEntry,
          testEntry,
          registrant
        ] = await Promise.all(dataSources)

        const { names } = cache.readQuery({ query: GET_ALL_NODES })

        let detailedNode = adjustForShortNames({
          ...node,
          ...registrarEntry,
          ...domainDetails,
          ...dnsEntry,
          ...testEntry,
          registrant: registrant
            ? registrant
            : registrarEntry.registrant
            ? registrarEntry.registrant
            : null,
          parent,
          parentOwner,
          __typename: 'Node'
        })

        detailedNode = setState(detailedNode)
        // Override parentOwner for dns if exists
        if (
          dnsEntry &&
          dnsEntry.parentOwner &&
          parseInt(dnsEntry.parentOwner) !== 0 &&
          parseInt(detailedNode.parentOwner) === 0
        ) {
          detailedNode.parentOwner = dnsEntry.parentOwner
        }
        const data = {
          names: [...names, detailedNode]
        }

        cache.writeData({ data })

        return detailedNode
      } catch (e) {
        console.log('Error in Single Name', e)
        throw e
      }
    },
    getResolverMigrationInfo: async (_, { name, resolver }, { cache }) => {
      /* TODO add hardcoded resolver addresses */
      const ens = getENS()
      const networkId = await getNetworkId()

      const RESOLVERS = {
        1: {
          DEPRECATED: [],
          OLD: [
            '0x5ffc014343cd971b7eb70732021e26c35b744cc4',
            '0x6dbc5978711cb22d7ba611bc18cec308ea12ea95',
            '0xd3ddccdd3b25a8a7423b5bee360a42146eb4baf3',
            '0x226159d592e2b063810a10ebf6dcbada94ed68b8'
          ]
        },
        3: {
          OLD: [
            '0x12299799a50340FB860D276805E78550cBaD3De3', // Ropsten
            '0x9C4c3B509e47a298544d0fD0591B47550845e903' // Ropsten
          ],
          DEPRECATED: []
        },
        4: {
          OLD: ['0x06E6B4E68b0B9B2617b35Eec811535050999282F'],
          DEPRECATED: []
        },
        5: {
          OLD: ['0xfF77b96d6bafCec0D684bB528b22e0Ab09C70663'],
          DEPRECATED: []
        }
      }

      let DEPRECATED_RESOLVERS = []
      let OLD_RESOLVERS = [
        '0xDaaF96c344f63131acadD0Ea35170E7892d3dfBA' // all networks
      ]

      if (RESOLVERS[networkId]) {
        DEPRECATED_RESOLVERS = [...RESOLVERS[networkId].DEPRECATED]
        OLD_RESOLVERS = [...OLD_RESOLVERS, ...RESOLVERS[networkId].OLD]
      }

      if (
        process &&
        process.env.REACT_APP_STAGE === 'local' &&
        process.env.REACT_APP_DEPRECATED_RESOLVERS
      ) {
        const localResolvers = process.env.REACT_APP_DEPRECATED_RESOLVERS.split(
          ','
        )
        DEPRECATED_RESOLVERS = [...DEPRECATED_RESOLVERS, ...localResolvers]
      }

      /* Deprecated resolvers are using the new registry and can be continued to be used*/

      function calculateIsDeprecatedResolver(address) {
        return DEPRECATED_RESOLVERS.map(a => a.toLowerCase()).includes(
          address.toLowerCase()
        )
      }

      /* Old Public resolvers are using the old registry and must be migrated  */

      function calculateIsOldPublicResolver(address) {
        return OLD_RESOLVERS.map(a => a.toLowerCase()).includes(
          address.toLowerCase()
        )
      }

      async function calculateIsPublicResolverReady() {
        const publicResolver = await ens.getAddress('resolver.eth')
        return !OLD_RESOLVERS.map(a => a.toLowerCase()).includes(publicResolver)
      }

      let isDeprecatedResolver = calculateIsDeprecatedResolver(resolver)
      let isOldPublicResolver = calculateIsOldPublicResolver(resolver)
      let isPublicResolverReady = await calculateIsPublicResolverReady()
      const resolverMigrationInfo = {
        name,
        isDeprecatedResolver,
        isOldPublicResolver,
        isPublicResolverReady,
        __typename: 'ResolverMigration'
      }
      return resolverMigrationInfo
    },
    isMigrated: async (_, { name }, { cache }) => {
      const ens = getENS()
      let result = await ens.isMigrated(name)
      return result
    },
    isContractController: async (_, { address }, { cache }) => {
      let provider = await getWeb3()
      const bytecode = await provider.getCode(address)
      return bytecode !== '0x'
    },
    getSubDomains: async (_, { name }, { cache }) => {
      const ens = getENS()
      const rawSubDomains = await ens.getSubdomains(name)

      return {
        subDomains: rawSubDomains,
        __typename: 'SubDomains'
      }
    },
    getReverseRecord: async (_, { address }, { cache }) => {
      let name = emptyAddress
      const ens = getENS()
      const obj = {
        name,
        address,
        __typename: 'ReverseRecord'
      }
      if (!address) return obj

      try {
        const { name: reverseName } = await ens.getName(address)
        const reverseAddress = await ens.getAddress(reverseName)
        const normalisedName = normalize(reverseName)
        if (
          parseInt(address) === parseInt(reverseAddress) &&
          reverseName === normalisedName
        ) {
          name = reverseName
        }
        if (name !== null) {
          const avatar = await ens.getText(name, 'avatar')
          return {
            ...obj,
            name,
            addr: reverseAddress,
            avatar,
            match: false
          }
        } else {
          return {
            ...obj,
            name: null,
            match: false
          }
        }
      } catch (e) {
        console.log(e)
        return {
          ...obj,
          name: null,
          match: false
        }
      }
    },
    getText: async (_, { name, key }) => {
      const ens = getENS()
      const text = await ens.getText(name, key)
      if (text === '') {
        return null
      }

      return text
    },
    getAddr: async (_, { name, key }) => {
      const ens = getENS()
      const address = await ens.getAddr(name, key)
      if (address === '') {
        return null
      }

      return address
    },
    getAddresses: async (_, { name, keys }) => {
      const ens = getENS()
      const addresses = keys.map(key =>
        ens.getAddr(name, key).then(addr => ({ key, value: addr }))
      )
      return Promise.all(addresses)
    },
    getTextRecords: async (_, { name, keys }) => {
      const ens = getENS()
      const textRecords = keys.map(key =>
        ens.getText(name, key).then(addr => ({ key, value: addr }))
      )
      return Promise.all(textRecords)
    },
    waitBlockTimestamp: async (_, { waitUntil }) => {
      if (waitUntil) {
        let block = await getBlock()
        let timestamp = block.timestamp * 1000
        while (timestamp < waitUntil) {
          block = await getBlock()
          timestamp = block.timestamp * 1000
          await delay(1000)
        }
        return true
      } else {
        return false
      }
    },
    getBalance: async (_, { address }) => {
      const provider = await getProvider()
      let balance
      try {
        balance = await provider.getBalance(address)
      } catch (e) {
        console.log(e)
      }
      return balance
    }
  },
  Mutation: {
    registerTestdomain: async (_, { label }) => {
      const registrar = getRegistrar()
      const tx = await registrar.registerTestdomain(label)
      return sendHelper(tx)
    },
    setName: async (_, { name }) => {
      try {
        const ens = getENS()
        const tx = await ens.claimAndSetReverseRecordName(name)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    setOwner: async (_, { name, address }, { cache }) => {
      try {
        const ens = getENS()
        const tx = await ens.setOwner(name, address)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    setSubnodeOwner: async (_, { name, address }, { cache }) => {
      try {
        const ens = getENS()
        const tx = await ens.setSubnodeOwner(name, address)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    setResolver: async (_, { name, address }, { cache }) => {
      try {
        const ens = getENS()
        const tx = await ens.setResolver(name, address)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    setAddress: async (_, { name, recordValue }, { cache }) => {
      try {
        const ens = getENS()
        const tx = await ens.setAddress(name, recordValue)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    setAddr: async (_, { name, key, recordValue }, { cache }) => {
      try {
        const ens = getENS()
        const tx = await ens.setAddr(name, key, recordValue)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    setContent: async (_, { name, recordValue }, { cache }) => {
      try {
        const ens = getENS()
        const tx = await ens.setContent(name, recordValue)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    setContenthash: async (_, { name, recordValue }, { cache }) => {
      try {
        const ens = getENS()
        const tx = await ens.setContenthash(name, recordValue)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    setText: async (_, { name, key, recordValue }, { cache }) => {
      try {
        const ens = getENS()
        const tx = await ens.setText(name, key, recordValue)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    addMultiRecords: async (_, { name, records }, { cache }) => {
      const ens = getENS()

      const provider = await getProvider()
      const resolver = await ens.getResolver(name)
      const resolverInstanceWithoutSigner = await getResolverContract({
        address: resolver,
        provider
      })
      const signer = await getSigner()
      const resolverInstance = resolverInstanceWithoutSigner.connect(signer)

      if (records.length === 1) {
        return await handleSingleTransaction(name, records[0], resolverInstance)
      }
      debugger
      return await handleMultipleTransactions(name, records, resolverInstance)
    },
    migrateResolver: async (_, { name }, { cache }) => {
      const ens = getENS()
      const provider = await getProvider()

      function setupTransactions({ name, records, resolverInstance }) {
        try {
          const resolver = resolverInstance.interface
          const namehash = getNamehash(name)
          const transactionArray = records.map((record, i) => {
            switch (i) {
              case 0:
                if (parseInt(record, 16) === 0) return undefined
                let encoded = resolver.encodeFunctionData(
                  'setAddr(bytes32,address)',
                  [namehash, record]
                )
                return encoded
              case 1:
                if (!record || parseInt(record, 16) === 0) return undefined
                const encodedContenthash = record
                return resolver.encodeFunctionData('setContenthash', [
                  namehash,
                  encodedContenthash
                ])
              case 2:
                return record.map(textRecord => {
                  if (textRecord.value.length === 0) return undefined
                  return resolver.encodeFunctionData('setText', [
                    namehash,
                    textRecord.key,
                    textRecord.value
                  ])
                })
              case 3:
                return record.map(coinRecord => {
                  if (parseInt(coinRecord.value, 16) === 0) return undefined
                  const { decoder, coinType } = formatsByName[coinRecord.key]
                  let addressAsBytes
                  if (!coinRecord.value || coinRecord.value === '') {
                    addressAsBytes = Buffer.from('')
                  } else {
                    addressAsBytes = decoder(coinRecord.value)
                  }
                  return resolverInstance.encodeFunctionData(
                    'setAddr(bytes32,uint256,bytes)',
                    [namehash, coinType, addressAsBytes]
                  )
                })
              default:
                throw Error('More records than expected')
            }
          })

          // flatten textrecords and addresses and remove undefined
          return transactionArray.flat().filter(bytes => bytes)
        } catch (e) {
          console.log('error creating transaction array', e)
        }
      }

      function calculateIsOldContentResolver(resolver) {
        const oldContentResolvers = [
          '0x5ffc014343cd971b7eb70732021e26c35b744cc4',
          '0x6dbc5978711cb22d7ba611bc18cec308ea12ea95',
          '0xbf80bc10d6ebfee11bea9a157d762110a0b73d95'
        ]
        const localResolvers = process.env.REACT_APP_OLD_CONTENT_RESOLVERS
          ? process.env.REACT_APP_OLD_CONTENT_RESOLVERS.split(',')
          : []

        const oldResolvers = [...oldContentResolvers, ...localResolvers].map(
          a => {
            return a.toLowerCase()
          }
        )

        return oldResolvers.includes(resolver.toLowerCase())
      }

      function buildKeyValueObjects(keys, values) {
        return values.map((record, i) => ({
          key: keys[i],
          value: record
        }))
      }

      async function getAllTextRecords(name) {
        const promises = TEXT_RECORD_KEYS.map(key => ens.getText(name, key))
        const records = await Promise.all(promises)
        return buildKeyValueObjects(TEXT_RECORD_KEYS, records)
      }

      async function getAllTextRecordsWithResolver(name, resolver) {
        const promises = TEXT_RECORD_KEYS.map(key =>
          ens.getTextWithResolver(name, key, resolver)
        )
        const records = await Promise.all(promises)
        return buildKeyValueObjects(TEXT_RECORD_KEYS, records)
      }

      async function getAllAddresses(name) {
        const promises = COIN_LIST_KEYS.map(key => ens.getAddr(name, key))
        const records = await Promise.all(promises)
        return buildKeyValueObjects(COIN_LIST_KEYS, records)
      }

      async function getAllAddressesWithResolver(name, resolver) {
        const promises = COIN_LIST_KEYS.map(key =>
          ens.getAddrWithResolver(name, key, resolver)
        )
        const records = await Promise.all(promises)
        return buildKeyValueObjects(COIN_LIST_KEYS, records)
      }

      async function getOldContent(name) {
        const resolver = await ens.getResolver(name)
        const namehash = getNamehash(name)
        const resolverInstanceWithoutSigner = await getOldResolverContract({
          address: resolver,
          provider
        })
        const content = await resolverInstanceWithoutSigner.content(namehash)
        const { encoded } = encodeContenthash('bzz://' + content)
        return encoded
      }

      async function getContenthash(name) {
        const resolver = await ens.getResolver(name)
        return getContenthashWithResolver(name, resolver)
      }

      async function getContenthashWithResolver(name, resolver) {
        const namehash = getNamehash(name)
        const resolverInstanceWithoutSigner = await getResolverContract({
          address: resolver,
          provider
        })
        const contentHash = await resolverInstanceWithoutSigner.contenthash(
          namehash
        )
        return contentHash
      }

      async function getAllRecords(name, isOldContentResolver) {
        const promises = [
          ens.getAddress(name),
          isOldContentResolver ? getOldContent(name) : getContenthash(name),
          getAllTextRecords(name),
          getAllAddresses(name)
        ]
        return Promise.all(promises)
      }

      async function getAllRecordsNew(name, publicResolver) {
        const promises = [
          ens.getEthAddressWithResolver(name, publicResolver),
          getContenthashWithResolver(name, publicResolver),
          getAllTextRecordsWithResolver(name, publicResolver),
          getAllAddressesWithResolver(name, publicResolver)
        ]
        return Promise.all(promises)
      }

      function areRecordsEqual(oldRecords, newRecords) {
        return isEqual(oldRecords, newRecords)
      }

      // get public resolver
      try {
        const publicResolver = await ens.getAddress('resolver.eth')
        const resolver = await ens.getResolver(name)
        const isOldContentResolver = calculateIsOldContentResolver(resolver)

        // get old and new records in parallel
        const [records, newResolverRecords] = await Promise.all([
          getAllRecords(name, isOldContentResolver),
          getAllRecordsNew(name, publicResolver)
        ])

        // compare new and old records
        if (!areRecordsEqual(records, newResolverRecords)) {
          //get the transaction by using contract.method.encode from ethers
          const resolverInstanceWithoutSigner = await getResolverContract({
            address: publicResolver,
            provider
          })
          const signer = await getSigner()
          const resolverInstance = resolverInstanceWithoutSigner.connect(signer)
          const transactionArray = setupTransactions({
            name,
            records,
            resolverInstance
          })
          //add them all together into one transaction
          const tx1 = await resolverInstance.multicall(transactionArray)
          //once the record has been migrated, migrate the resolver using setResolver to the new public resolver
          const tx2 = await ens.setResolver(name, publicResolver)
          //await migrate records into new resolver
          return sendHelperArray([tx1, tx2])
        } else {
          const tx = await ens.setResolver(name, publicResolver)
          const value = await sendHelper(tx)
          return [value]
        }
      } catch (e) {
        console.log('Error migrating resolver', e)
        throw e
      }
    },
    migrateRegistry: async (_, { name, address }, { cache }) => {
      try {
        const ens = getENS()
        const resolver = await ens.getResolver(name)
        const tx = await ens.setSubnodeRecord(name, address, resolver)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    createSubdomain: async (_, { name }, { cache }) => {
      try {
        const ens = getENS()
        const tx = await ens.createSubdomain(name)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    deleteSubdomain: async (_, { name }, { cache }) => {
      try {
        const ens = getENS()
        const tx = await ens.deleteSubdomain(name)
        return sendHelper(tx)
      } catch (e) {
        console.log(e)
      }
    },
    addFavourite: async (_, { domain }, { cache }) => {
      const newFavourite = {
        ...domain,
        __typename: 'Domain'
      }

      const previous = cache.readQuery({ query: GET_FAVOURITES })

      const data = {
        favourites: [...previous.favourites, newFavourite]
      }
      cache.writeData({ data })
      window.localStorage.setItem(
        'ensFavourites',
        JSON.stringify(data.favourites)
      )
      return data
    },
    deleteFavourite: async (_, { domain }, { cache }) => {
      const previous = cache.readQuery({ query: GET_FAVOURITES })

      const data = {
        favourites: previous.favourites.filter(
          previousDomain => previousDomain.name !== domain.name
        )
      }

      cache.writeData({ data })
      window.localStorage.setItem(
        'ensFavourites',
        JSON.stringify(data.favourites)
      )
      return data
    },
    addSubDomainFavourite: async (_, { domain }, { cache }) => {
      const previous = cache.readQuery({ query: GET_SUBDOMAIN_FAVOURITES })

      const newFavourite = {
        ...domain,
        __typename: 'SubDomain'
      }

      const data = {
        subDomainFavourites: [...previous.subDomainFavourites, newFavourite]
      }
      cache.writeData({ data })
      window.localStorage.setItem(
        'ensSubDomainFavourites',
        JSON.stringify(data.subDomainFavourites)
      )
      return data
    },
    deleteSubDomainFavourite: async (_, { domain }, { cache }) => {
      const previous = cache.readQuery({ query: GET_SUBDOMAIN_FAVOURITES })

      const data = {
        subDomainFavourites: previous.subDomainFavourites.filter(
          previousDomain => previousDomain.name !== domain.name
        )
      }

      cache.writeData({ data })
      window.localStorage.setItem(
        'ensSubDomainFavourites',
        JSON.stringify(data.subDomainFavourites)
      )
      return data
    }
  }
}

export default resolvers

export { defaults }
