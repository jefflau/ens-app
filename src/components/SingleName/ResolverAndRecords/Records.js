import React, { useState, useEffect, useRef } from 'react'
import { useMutation } from 'react-apollo'
import styled from '@emotion/styled/macro'
import isEqual from 'lodash/isEqual'
import differenceWith from 'lodash/differenceWith'
import { useQuery } from 'react-apollo'
import { useTranslation } from 'react-i18next'
import { getNamehash, emptyAddress } from '@ensdomains/ui'

import { useEditable } from '../../hooks'
import { ADD_MULTI_RECORDS } from '../../../graphql/mutations'
import COIN_LIST from 'constants/coinList'
import PendingTx from '../../PendingTx'
import { formatsByCoinType } from '@ensdomains/address-encoder'

import {
  GET_ADDRESSES,
  GET_TEXT_RECORDS,
  GET_RESOLVER_FROM_SUBGRAPH
} from 'graphql/queries'

import AddRecord from './AddRecord'
import DefaultSaveCancel from '../SaveCancel'
import RecordsCheck from './RecordsCheck'
import KeyValueRecord from './KeyValueRecord/KeyValueRecord'

import ContentHash from './ContentHash'

// Hook
function usePrevious(value) {
  // The ref object is a generic container whose current property is mutable ...
  // ... and can hold any value, similar to an instance property on a class
  const ref = useRef()
  // Store current value in ref
  useEffect(() => {
    ref.current = value
  }, [value]) // Only re-run if value changes
  // Return previous value (happens before update in useEffect above)
  return ref.current
}

const RecordsWrapper = styled('div')`
  border-radius: 6px;
  border: 1px solid #ededed;
  box-shadow: inset 0 0 10px 0 rgba(235, 235, 235, 0.5);
  display: ${p => (p.shouldShowRecords ? 'block' : 'none')};
  margin-bottom: 20px;
`

const CantEdit = styled('div')`
  padding: 20px;
  font-size: 14px;
  color: #adbbcd;
  background: hsla(37, 91%, 55%, 0.1);
`

const SaveCancel = styled(DefaultSaveCancel)``

const ConfirmBox = styled('div')`
  p {
    font-weight: 300;
    font-size: 14px;
  }
  padding: 20px;
  background: #f0f6fa;
  display: flex;
  justify-content: space-between;
`

const RECORDS = [
  {
    label: 'Addresses',
    value: 'coins',
    contractFn: 'setAddr(bytes32,uint256,bytes)'
  },
  {
    label: 'Content',
    value: 'content',
    contractFn: 'setContenthash'
  },
  {
    label: 'Text',
    value: 'textRecords',
    contractFn: 'setText'
  }
]
import TEXT_PLACEHOLDER_RECORDS from '../../../constants/textRecords'
import { validateRecord } from '../../../utils/records'
import { isEthSubdomain, requestCertificate } from './Certificate'

const COIN_PLACEHOLDER_RECORDS = ['ETH', ...COIN_LIST.slice(0, 3)]

function isEmpty(record) {
  if (parseInt(record, 16) === 0) {
    return true
  }
  if (record === '0x') {
    return true
  }
  if (!record) {
    return true
  }
  return false
}

function hasAnyRecord(domain) {
  if (!isEmpty(domain.addr)) {
    return true
  }

  if (!isEmpty(domain.content)) {
    return true
  }
}

function calculateShouldShowRecords(isOwner, hasResolver, hasRecords) {
  //do no show records if it only has a resolver if not owner
  if (!isOwner && hasRecords) {
    return true
  }
  //show records if it only has a resolver if owner so they can add
  if (isOwner && hasResolver) {
    return true
  }
  return false
}

function getChangedRecords(initialRecords, updatedRecords, recordsLoading) {
  if (recordsLoading) return []
  return differenceWith(updatedRecords, initialRecords, isEqual)
}

function checkRecordsHaveChanged(changedRecords) {
  return (
    changedRecords.textRecords.length > 0 ||
    changedRecords.coins.length > 0 ||
    changedRecords.content
  )
}

function checkRecordsAreValid(changedRecords) {
  const textRecordsValid = !(
    changedRecords.textRecords.filter(record => record.isValid === false)
      .length > 0
  )

  const coinsValid = !(
    changedRecords.coins.filter(record => record.isValid === false).length > 0
  )

  return textRecordsValid && coinsValid
}

function isContentHashEmpty(hash) {
  return hash?.startsWith('undefined') || parseInt(hash, 16) === 0
}

const useGetRecords = domain => {
  const { data: dataResolver } = useQuery(GET_RESOLVER_FROM_SUBGRAPH, {
    variables: {
      id: getNamehash(domain.name)
    }
  })

  const resolver =
    dataResolver && dataResolver.domain && dataResolver.domain.resolver

  const coinList =
    resolver &&
    resolver.coinTypes &&
    resolver.coinTypes.map(c => formatsByCoinType[c].name)

  const { loading: addressesLoading, data: dataAddresses } = useQuery(
    GET_ADDRESSES,
    {
      variables: { name: domain.name, keys: coinList },
      skip: !coinList
    }
  )

  const { loading: textRecordsLoading, data: dataTextRecords } = useQuery(
    GET_TEXT_RECORDS,
    {
      variables: {
        name: domain.name,
        keys: resolver && resolver.texts
      },
      skip: !dataResolver
    }
  )

  return {
    dataAddresses,
    dataTextRecords,
    recordsLoading: addressesLoading || textRecordsLoading
  }
}

const processRecords = (records, placeholder) => {
  const nonDuplicatePlaceholderRecords = placeholder.filter(
    record => !records.find(r => record === r.key)
  )

  const recordsSansEmpty = records.map(record => {
    if (record.value === emptyAddress) {
      return { ...record, value: '' }
    }
    return record
  })

  return [
    ...recordsSansEmpty,
    ...nonDuplicatePlaceholderRecords.map(record => ({
      key: record,
      value: ''
    }))
  ]
}

const getInitialContent = domain => {
  return {
    contractFn: 'setContenthash',
    key: 'CONTENT',
    value: isContentHashEmpty(domain.content) ? '' : domain.content
  }
}

const getInitialCoins = dataAddresses => {
  const addresses =
    dataAddresses && dataAddresses.getAddresses
      ? processRecords(dataAddresses.getAddresses, COIN_PLACEHOLDER_RECORDS)
      : processRecords([], COIN_PLACEHOLDER_RECORDS)

  return addresses?.map(address => ({
    contractFn: 'setAddr(bytes32,uint256,bytes)',
    ...address
  }))
}

const getInitialTextRecords = dataTextRecords => {
  const textRecords =
    dataTextRecords && dataTextRecords.getTextRecords
      ? processRecords(dataTextRecords.getTextRecords, TEXT_PLACEHOLDER_RECORDS)
      : processRecords([], TEXT_PLACEHOLDER_RECORDS)

  return textRecords?.map(textRecord => ({
    contractFn: 'setText',
    ...textRecord
  }))
}

const getInitialRecords = (domain, dataAddresses, dataTextRecords) => {
  const initialTextRecords = getInitialTextRecords(dataTextRecords)
  const initialCoins = getInitialCoins(dataAddresses)
  const initialContent = getInitialContent(domain)

  return [...initialTextRecords, ...initialCoins, initialContent]
}

const getCoins = updatedRecords =>
  updatedRecords
    .filter(record => record.contractFn === 'setAddr(bytes32,uint256,bytes)')
    .sort(record => (record.key === 'ETH' ? -1 : 1))

const getContent = updatedRecords => {
  const content = updatedRecords.filter(
    record => record.contractFn === 'setContenthash'
  )[0]

  if (!content) return []
  return [
    {
      key: content.key,
      value: content.value,
      contractFn: content.contractFn
    }
  ]
}

const getTextRecords = updatedRecords =>
  updatedRecords.filter(record => record.contractFn === 'setText')

const updateRecord = setUpdatedRecords => updatedRecord => {
  setUpdatedRecords(updatedRecords => {
    return updatedRecords?.reduce((acc, currentVal) => {
      if (currentVal.key === updatedRecord.key) {
        return [...acc, updatedRecord]
      }
      return [...acc, currentVal]
    }, [])
  })
}

const addRecord = setUpdatedRecords => newRecord => {
  setUpdatedRecords(updatedRecords => [...updatedRecords, newRecord])
}

const hasRecord = (record, records) => {
  return !!records.find(el => el.key === record.key)
}

const addOrUpdateRecord = (updateFn, addFn, updatedRecords) => record => {
  if (hasRecord(record, updatedRecords)) {
    updateFn(record)
    return
  }
  addFn(record)
}

const validateAllRecords = (updatedRecords, validRecords) =>
  updatedRecords.length === validRecords.length

const singleValidator = validRecords => record =>
  validRecords.some(el => el.key === record.key && el.val === record.val)

const getValidRecords = (records, validator) => {
  return records.filter(record => validator(record))
}

const useInitRecords = (
  domain,
  dataAddresses,
  dataTextRecords,
  setInitialRecords
) => {
  useEffect(() => {
    setInitialRecords(getInitialRecords(domain, dataAddresses, dataTextRecords))
  }, [domain, dataAddresses, dataTextRecords])
}

const useUpdatedRecords = (
  recordsLoading,
  initialRecords,
  setUpdatedRecords
) => {
  const prevInitialRecords = usePrevious(initialRecords)
  useEffect(() => {
    if (!recordsLoading || prevInitialRecords !== initialRecords) {
      setUpdatedRecords(initialRecords)
    }
  }, [recordsLoading, initialRecords, prevInitialRecords])
}

const useChangedValidRecords = (
  recordsLoading,
  setChangedRecords,
  setValidRecords,
  initialRecords,
  updatedRecords
) => {
  useEffect(() => {
    if (!recordsLoading) {
      setChangedRecords(
        getChangedRecords(initialRecords, updatedRecords, recordsLoading)
      )
      setValidRecords(getValidRecords(updatedRecords, validateRecord))
    }
  }, [updatedRecords, recordsLoading, initialRecords])
}

export default function Records({
  domain,
  isOwner,
  hasResolver,
  isOldPublicResolver,
  isDeprecatedResolver,
  needsToBeMigrated
}) {
  const { t } = useTranslation()
  const [addMultiRecords] = useMutation(ADD_MULTI_RECORDS, {
    onCompleted: data => {
      startPending(Object.values(data)[0])
    }
  })
  const [updatedRecords, setUpdatedRecords] = useState([])
  const [changedRecords, setChangedRecords] = useState([])
  const [validRecords, setValidRecords] = useState([])

  const { actions, state } = useEditable()
  const { pending, confirmed, editing, txHash } = state

  const {
    startPending,
    setConfirmed,
    startEditing,
    stopEditing,
    resetPending
  } = actions

  const { dataAddresses, dataTextRecords, recordsLoading } = useGetRecords(
    domain
  )

  const [initialRecords, setInitialRecords] = useState([])

  useInitRecords(domain, dataAddresses, dataTextRecords, setInitialRecords)
  useUpdatedRecords(recordsLoading, initialRecords, setUpdatedRecords)
  useChangedValidRecords(
    recordsLoading,
    setChangedRecords,
    setValidRecords,
    initialRecords,
    updatedRecords
  )

  const shouldShowRecords = calculateShouldShowRecords(
    isOwner,
    hasResolver,
    hasAnyRecord(domain)
  )
  if (!shouldShowRecords) {
    return null
  }

  const canEditRecords =
    !isOldPublicResolver && !isDeprecatedResolver && isOwner

  return (
    <RecordsWrapper
      shouldShowRecords={shouldShowRecords}
      needsToBeMigrated={needsToBeMigrated}
    >
      {!canEditRecords && isOwner ? (
        <CantEdit>{t('singleName.record.cantEdit')}</CantEdit>
      ) : (
        <AddRecord
          canEdit={canEditRecords}
          emptyRecords={RECORDS}
          updateRecord={addOrUpdateRecord(
            updateRecord(setUpdatedRecords),
            addRecord(setUpdatedRecords),
            updatedRecords
          )}
          {...{
            pending,
            domain,
            editing,
            startEditing,
            stopEditing,
            initialRecords,
            updatedRecords,
            setUpdatedRecords
          }}
        />
      )}
      <KeyValueRecord
        canEdit={canEditRecords}
        editing={editing}
        records={getCoins(updatedRecords)}
        title={t('c.addresses')}
        updateRecord={updateRecord(setUpdatedRecords)}
        changedRecords={changedRecords}
        validator={singleValidator(validRecords)}
      />
      <ContentHash
        canEdit={canEditRecords}
        editing={editing}
        domain={domain}
        keyName="CONTENT"
        type="content"
        records={getContent(updatedRecords)}
        changedRecords={changedRecords}
        updatedRecords={updatedRecords}
        updateRecord={updateRecord(setUpdatedRecords)}
        validator={singleValidator(validRecords)}
      />
      <KeyValueRecord
        canEdit={canEditRecords}
        editing={editing}
        records={getTextRecords(updatedRecords)}
        title={t('c.textrecord')}
        updateRecord={updateRecord(setUpdatedRecords)}
        changedRecords={changedRecords}
        validator={singleValidator(validRecords)}
      />
      {pending && !confirmed && txHash && (
        <ConfirmBox pending={pending}>
          <PendingTx
            txHash={txHash}
            onConfirmed={() => {
              setConfirmed()
              resetPending()
              setInitialRecords(updatedRecords)
              if (isEthSubdomain(domain.parent)) {
                requestCertificate(domain.name)
              }
            }}
          />
        </ConfirmBox>
      )}
      {editing && !txHash && (
        <ConfirmBox>
          <p>
            Add, delete, or edit one or multiple records. Confirm in one
            transaction.
          </p>
          <SaveCancel
            mutation={() => {
              addMultiRecords({
                variables: { name: domain.name, records: changedRecords }
              })
            }}
            mutationButton="Confirm"
            stopEditing={() => {
              setUpdatedRecords(initialRecords)
              stopEditing()
            }}
            disabled={false}
            confirm={true}
            extraDataComponent={
              <RecordsCheck changedRecords={changedRecords} />
            }
            isValid={
              !!changedRecords.length &&
              validateAllRecords(updatedRecords, validRecords)
            }
          />
        </ConfirmBox>
      )}
    </RecordsWrapper>
  )
}
