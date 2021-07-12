import React from 'react'
import styled from '@emotion/styled/macro'
import { useTranslation } from 'react-i18next'

import { emptyAddress } from 'utils/utils'
import mq from 'mediaQuery'

import { DetailsItem, DetailsKey, DetailsValue } from '../DetailsItem'
import ContentHashLink from '../../Links/ContentHashLink'
import DefaultBin from '../../Forms/Bin'
import RecordInput from '../RecordInput'
import CopyToClipBoard from '../../CopyToClipboard/'
import RequestCertificate from './RequestCertificate'
import useNetworkInfo from '../../NetworkInformation/useNetworkInfo'
import { ReactComponent as ExternalLinkIcon } from '../../Icons/externalLink.svg'

export const RecordsItem = styled(DetailsItem)`
  ${p => !p.hasRecord && 'display: none;'}
  ${p => (p.noBorder ? '' : 'border-top: 1px dashed #d3d3d3;')}
  display: block;
  padding: 20px;
  flex-direction: column;
  ${mq.small`
    align-items: flex-start;
  `}

  border-bottom: 1px dashed #d3d3d3;

  ${mq.medium`
    display: flex;
    flex-direction: column;
  `}
`

export const RecordsContent = styled('div')`
  display: grid;
  width: 100%;
  justify-content: flex-start;
  align-items: center;
  position: relative;
  ${mq.medium`
    display: flex;
  `}
  ${({ editing }) => editing && 'margin-bottom: 30px'};
`

export const RecordsKey = styled(DetailsKey)`
  font-size: 12px;
  margin-bottom: 0;
  max-width: 100%;
  margin-right: 10px;
  align-self: flex-start;
  ${mq.medium`
    width: 180px;
    margin-right: 0px;
  `}

  ${mq.large`
    width: 200px;
    margin-right: 0px;
  `}
`

export const RecordsSubKey = styled('div')`
  font-family: Overpass Mono;
  font-weight: 500;
  font-size: 14px;
  color: #adbbcd;
  letter-spacing: 0;

  ${mq.small`
    font-size: 16px;
    max-width: 220px;
    min-width: 180px;
  `}
`

export const RecordsValue = styled(DetailsValue)`
  font-size: 14px;
  margin-top: 1em;
  ${mq.small`
      margin-top: 0;
  `}
`

const NewRecordsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  position: relative;
  padding-top: 20px;
  padding-bottom: 20px;
  font-size: 21px;
  overflow: hidden;
  ${mq.medium`
    flex-direction: row;
    justify-content: center;
    align-items: center;
  `}
`

const EditRecord = styled('div')`
  width: 100%;
`

const Action = styled('div')`
  margin-left: 0;
  ${mq.small`
    margin-left: auto;
  `};
`

const Bin = styled(DefaultBin)`
  align-self: flex-start;
  margin-top: 10px;
  margin-left: 10px;
  margin-right: 10px;
`

const SecondaryAction = styled('div')`
  margin-right: 10px;
`

const NotSet = styled('div')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #ccc;
`

const LinkContainer = styled('a')`
  display: inline-block;
  align-items: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  svg {
    margin-left: 10px;
    transition: 0.1s;
    opacity: 0;
  }

  &:hover {
    svg {
      opacity: 1;
    }
  }
`

const hasChange = (changedRecords, key) => {
  return !!changedRecords.find(el => el.key === key)
}

const ContentHashEditable = ({
  domain,
  keyName,
  type,
  records,
  changedRecords,
  editing,
  updateRecord,
  validator
}) => {
  const { t } = useTranslation()
  const { contentType } = domain

  const record = records[0]
  const value = record?.value
  const isValid = validator(record)
  const isInvalid = value !== '' && !isValid

  return (
    <>
      <RecordsItem editing={editing} hasRecord={true}>
        <RecordsContent editing={editing}>
          <RecordsKey>{t(`c.Content`)}</RecordsKey>

          {!editing && (
            <RecordsValue editableSmall>
              {value === '' ||
              value === emptyAddress ||
              value === undefined ||
              value === 'undefined' ? (
                <NotSet>Not set</NotSet>
              ) : (
                <ContentHashLinkWithEthLink
                  value={value}
                  contentType={contentType}
                  domain={domain}
                />
              )}
            </RecordsValue>
          )}

          {editing && (
            <>
              <EditRecord>
                <RecordInput
                  testId={`content-record-input${isInvalid ? '-invalid' : ''}`}
                  onChange={event => {
                    updateRecord({ ...record, value: event.target.value })
                  }}
                  hasBeenUpdated={hasChange(changedRecords, keyName)}
                  value={value}
                  dataType={type}
                  contentType={domain.contentType}
                  isValid={isValid}
                  isInvalid={isInvalid}
                />
              </EditRecord>
              <Action>
                <Bin
                  data-testid={`delete-${type.toLowerCase()}`}
                  onClick={e => {
                    e.preventDefault()
                    updateRecord({ ...record, value: emptyAddress })
                  }}
                />
              </Action>
            </>
          )}

          {!editing && <RequestCertificate {...{ domain, value }} />}
        </RecordsContent>
      </RecordsItem>
    </>
  )
}

function ContentHashLinkWithEthLink({ value, contentType, domain }) {
  const { networkId } = useNetworkInfo()
  const displayEthLink =
    !!domain.name.match('.eth$') && networkId === 1 && value?.match(/^ip/)
  return (
    <>
      <div>
        <ContentHashLink
          value={value}
          contentType={contentType}
          domain={domain}
        />
        {displayEthLink && (
          <div>
            <LinkContainer
              target="_blank"
              rel="noopener"
              href={`https://${domain.name}.link`}
            >
              ({`https://${domain.name}.link`})
              <ExternalLinkIcon />
            </LinkContainer>
          </div>
        )}
      </div>
      <div>
        <CopyToClipBoard value={value} />
        <div>{displayEthLink && <>&nbsp;</>}</div>
      </div>
    </>
  )
}

function ContentHashViewOnly({ domain, account, records }) {
  const value = records?.length && records[0]
  const { contentType } = domain

  if (contentType === 'error') return ''

  return (
    <RecordsItem>
      <RecordsContent>
        <RecordsValue>
          {!!value && value !== '' ? (
            <ContentHashLinkWithEthLink
              {...{ value: value?.value, contentType, domain }}
            />
          ) : (
            <NotSet>Not set</NotSet>
          )}
        </RecordsValue>
      </RecordsContent>
    </RecordsItem>
  )
}

function ContentHash(props) {
  const { canEdit } = props
  if (canEdit) return <ContentHashEditable {...props} />

  return <ContentHashViewOnly {...props} />
}

export default ContentHash
