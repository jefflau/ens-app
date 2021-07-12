import React from 'react'
import styled from '@emotion/styled'
import {
  ViewOnly as KeyValueViewOnly,
  KeyValueContainer as DefaultKeyValueContainer,
  KeyValuesList as DefaultKeyValuesList,
  Key as DefaultKey
} from './KeyValueRecord/'

import mq from 'mediaQuery'

import 'cross-fetch/polyfill'
const Key = styled(DefaultKey)`
  ${mq.small`
    margin-bottom: 0;
  `}
`

const KeyValuesList = styled(DefaultKeyValuesList)``

const KeyValueContainer = styled(DefaultKeyValueContainer)`
  padding: 0;
  margin-bottom: 20px;
`

const Contenthash = styled('div')`
  display: flex;
  margin-bottom: 20px;
`

const Delete = styled('span')`
  color: red;
`

export default function MultipleRecordsCheck({ changedRecords }) {
  return (
    <div>
      <KeyValueContainer>
        <KeyValuesList>
          {changedRecords.map(record =>
            record.value === '' ? (
              <KeyValueViewOnly
                textKey={record.key}
                value={record.value}
                remove={true}
              />
            ) : (
              <KeyValueViewOnly textKey={record.key} value={record.value} />
            )
          )}
        </KeyValuesList>
      </KeyValueContainer>
    </div>
  )
}
