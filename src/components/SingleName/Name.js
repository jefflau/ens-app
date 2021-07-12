import React from 'react'
import styled from '@emotion/styled/macro'
import { useTranslation } from 'react-i18next'

import { useMediaMin } from 'mediaQuery'
import { EMPTY_ADDRESS } from '../../utils/records'
import { Title } from '../Typography/Basic'
import TopBar from '../Basic/TopBar'
import DefaultFavourite from '../AddFavourite/Favourite'
import NameDetails from './NameDetails'
import DNSNameRegister from './DNSNameRegister'
import ShortName from './ShortName'
import Tabs from './Tabs'
import { useAccount } from '../QueryAccount'
import NameContainer from '../Basic/MainContainer'
import Copy from '../CopyToClipboard/'

const Owner = styled('div')`
  color: #ccd4da;
  margin-right: 20px;
`

const RightBar = styled('div')`
  display: flex;
  align-items: center;
`

const Favourite = styled(DefaultFavourite)``

function isRegistrationOpen(available, parent, isDeedOwner) {
  return parent === 'eth' && !isDeedOwner && available
}

function isDNSRegistrationOpen(domain) {
  const nameArray = domain.name.split('.')
  if (nameArray.length !== 2 || nameArray[1] === 'eth') {
    return false
  }
  return domain.isDNSRegistrar && domain.owner === EMPTY_ADDRESS
}

function isOwnerOfDomain(domain, account) {
  if (domain.owner !== EMPTY_ADDRESS && !domain.available) {
    return domain.owner.toLowerCase() === account.toLowerCase()
  }
  return false
}

function isOwnerOfParentDomain(domain, account) {
  if (domain.parentOwner !== EMPTY_ADDRESS) {
    return domain.parentOwner.toLowerCase() === account.toLowerCase()
  }
  return false
}

function Name({ details: domain, name, pathname, type, refetch }) {
  const { t } = useTranslation()
  const smallBP = useMediaMin('small')
  const percentDone = 0
  const account = useAccount()
  const isOwner = isOwnerOfDomain(domain, account)
  const isOwnerOfParent = isOwnerOfParentDomain(domain, account)
  const isDeedOwner = domain.deedOwner === account
  const isRegistrant = !domain.available && domain.registrant === account
  const registrationOpen = isRegistrationOpen(
    domain.available,
    domain.parent,
    isDeedOwner
  )
  const preferredTab = registrationOpen ? 'register' : 'details'

  let ownerType,
    registrarAddress = domain.parentOwner
  if (isDeedOwner || isRegistrant) {
    ownerType = 'Registrant'
  } else if (isOwner) {
    ownerType = 'Controller'
  }
  let containerState
  if (isDNSRegistrationOpen(domain)) {
    containerState = 'Open'
  } else {
    containerState = isOwner ? 'Yours' : domain.state
  }
  return (
    <>
      <NameContainer state={containerState}>
        <TopBar percentDone={percentDone}>
          <Title>
            {domain.decrypted
              ? name
              : '[unknown' +
                domain.name.split('.')[0].slice(1, 11) +
                ']' +
                '.' +
                domain.parent}
            <Copy
              value={
                domain.decrypted
                  ? name
                  : '[unknown' +
                    domain.name.split('.')[0].slice(1, 11) +
                    ']' +
                    '.' +
                    domain.parent
              }
            />
          </Title>
          <RightBar>
            {!!ownerType && (
              <Owner data-testid="owner-type">
                {ownerType === 'Registrant'
                  ? t('c.registrant')
                  : t('c.Controller')}
              </Owner>
            )}
            <Favourite domain={domain} />
            {smallBP && (
              <Tabs
                pathname={pathname}
                tab={preferredTab}
                domain={domain}
                parent={domain.parent}
              />
            )}
          </RightBar>
        </TopBar>
        {!smallBP && (
          <Tabs
            pathname={pathname}
            tab={preferredTab}
            domain={domain}
            parent={domain.parent}
          />
        )}
        {isDNSRegistrationOpen(domain) ? (
          <DNSNameRegister
            domain={domain}
            registrarAddress={registrarAddress}
            pathname={pathname}
            refetch={refetch}
            account={account}
            readOnly={account === EMPTY_ADDRESS}
          />
        ) : type === 'short' && domain.owner === EMPTY_ADDRESS ? ( // check it's short and hasn't been claimed already
          <ShortName name={name} />
        ) : (
          <NameDetails
            tab={preferredTab}
            domain={domain}
            pathname={pathname}
            name={name}
            isOwner={isOwner}
            isOwnerOfParent={isOwnerOfParent}
            refetch={refetch}
            account={account}
            registrationOpen={registrationOpen}
          />
        )}
      </NameContainer>
    </>
  )
}

export default Name
