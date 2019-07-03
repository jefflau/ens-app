import React, { useState } from 'react'
import styled from '@emotion/styled'
import { Mutation } from 'react-apollo'
import { SUBMIT_PROOF } from '../../../graphql/mutations'

import PendingTx from '../../PendingTx'
import Button from '../../Forms/Button'
import { ReactComponent as DefaultPencil } from '../../Icons/SmallPencil.svg'
import { ReactComponent as DefaultOrangeExclamation } from '../../Icons/OrangeExclamation.svg'
import { ReactComponent as ExternalLinkIcon } from '../../Icons/externalLink.svg'

const EtherScanLinkContainer = styled('span')`
  display: inline-block;
  transform: translate(25%, 20%);
`

const CTAContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 20px;
`

const LinkToLearnMore = styled('a')`
  margin-right: 1em;
  font-size: 14px;
  letter-spacing: 0.58px;
  text-align: center;
  margin-left: auto;
`

const Pencil = styled(DefaultPencil)`
  margin-right: 5px;
`

const Prompt = styled('span')`
  color: #ffa600;
  margin-right: 10px;
`

const OrangeExclamation = styled(DefaultOrangeExclamation)`
  margin-right: 5px;
`

const Exclamation = () => (
  <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8.739 5.82c-.039.746-.096 1.512-.134 2.258-.02.25-.02.268-.02.517a.723.723 0 0 1-.727.708.707.707 0 0 1-.727-.689c-.058-1.167-.134-2.143-.192-3.311l-.057-.938c-.02-.478.268-.9.727-1.034a.972.972 0 0 1 1.13.556c.057.153.095.306.095.478-.019.479-.057.976-.095 1.455m-.88 6.316a.98.98 0 0 1-.977-.976.98.98 0 0 1 .976-.976c.536 0 .976.44.957.995.02.517-.44.957-.957.957M7.93 0a7.93 7.93 0 1 0 0 15.86A7.93 7.93 0 0 0 7.93 0"
      fill="#F5A623"
      fillRule="evenodd"
    />
  </svg>
)

const Error = styled('span')`
  margin-left: 0.2em;
  font-size: 14px;
  color: #f5a623;
`

function getCTA({
  step,
  name,
  parentOwner,
  incrementStep,
  label,
  txHash,
  setTxHash,
  refetch,
  readOnly
}) {
  const CTAs = {
    ENABLE_DNSSEC: <Button onClick={() => refetch()}>Refresh</Button>,
    ADD_TEXT: <Button onClick={() => refetch()}>Refresh</Button>,
    SUBMIT_PROOF: (
      <Mutation
        mutation={SUBMIT_PROOF}
        onCompleted={data => {
          setTxHash(Object.values(data)[0])
          incrementStep()
        }}
      >
        {mutate => (
          <Button
            onClick={() => {
              mutate({ variables: { name, parentOwner } })
            }}
            type="primary"
          >
            Register
          </Button>
        )}
      </Mutation>
    ),
    SUBMIT_SENT: (
      <PendingTx
        txHash={txHash}
        onConfirmed={() => {
          incrementStep()
        }}
      />
    ),
    SUBMIT_CONFIRMED: (
      <Button onClick={() => refetch()}>
        <Pencil />
        View in Manager
      </Button>
    )
  }
  return CTAs[step]
}

const CTA = ({
  name,
  parentOwner,
  step,
  incrementStep,
  label,
  refetch,
  readOnly,
  error
}) => {
  const [txHash, setTxHash] = useState(undefined)
  return (
    <CTAContainer>
      {error ? (
        <>
          <Exclamation />
          <Error>{error}</Error>
        </>
      ) : null}
      <LinkToLearnMore
        href="https://medium.com/the-ethereum-name-service/how-to-claim-your-dns-domain-on-ens-e600ef2d92ca"
        target="_blank"
      >
        Learn More{' '}
        <EtherScanLinkContainer>
          <ExternalLinkIcon />
        </EtherScanLinkContainer>
      </LinkToLearnMore>
      {getCTA({
        step,
        name,
        parentOwner,
        incrementStep,
        label,
        txHash,
        setTxHash,
        refetch,
        readOnly
      })}
    </CTAContainer>
  )
}

export default CTA
