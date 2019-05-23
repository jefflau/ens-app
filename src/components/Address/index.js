import React, { useState } from 'react'
import styled from '@emotion/styled'
import mq from 'mediaQuery'
import ENS from 'ethereum-ens'

const AutoComplete = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  ${mq.medium`
      width: calc(100% - 162px);
      font-size: 28px;
  `}

  .address {
    font-size: 18px;
    padding: 0 0 0 20px;
    font-family: Overpass;
    font-weight: 100;
  }
  .error {
    color: #cc0000;
  }
`

const AddressForm = styled('form')`
  display: flex;
  position: relative;
  z-index: 10000;

  input {
    padding: 20px 0 0 20px;
    width: 100%;
    border: none;
    border-radius: 0;
    font-size: 18px;
    font-family: Overpass;
    font-weight: 100;
    ${mq.medium`
      width: calc(100% - 162px);
      font-size: 28px;
    `}

    &:focus {
      outline: 0;
    }

    &::-webkit-input-placeholder {
      /* Chrome/Opera/Safari */
      color: #ccd4da;
    }
  }

  button {
    background: #5284ff;
    color: white;
    font-size: 22px;
    font-family: Overpass;
    padding: 20px 0;
    height: 90px;
    width: 162px;
    border: none;
    display: none;
    ${mq.medium`
      display: block;
    `}

    &:hover {
      cursor: pointer;
    }
  }
`

function Address({ className, provider }) {
  const [value, setValue] = useState(null)
  const [resolvedAddress, setResolvedAddress] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const ethereumRegEx = /^0x[a-fA-F0-9]{40}$/
  return (
    <AddressForm
      className={className}
      onSubmit={async e => {
        e.preventDefault()
        if (ethereumRegEx.test(value)) {
          setResolvedAddress(value)
        } else {
          const ens = new ENS(provider)
          const address = await ens.resolver(value).addr()
          setResolvedAddress(address)
        }

        return false
      }}
    >
      <AutoComplete>
        <input
          type="text"
          value={value ? value : ''}
          onChange={e => setValue(e.target.value)}
          placeholder="Enter Address or ENS Name"
        />
        {resolvedAddress && <span className="address">{resolvedAddress}</span>}
        {errorMessage && <span className="error">{errorMessage}</span>}
      </AutoComplete>
      <button type="submit">Search</button>
    </AddressForm>
  )
}

export default Address
