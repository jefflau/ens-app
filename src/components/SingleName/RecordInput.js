import React from 'react'
import styled from '@emotion/styled/macro'

import { emptyAddress } from '../../utils/utils'
import DefaultInput from '../Forms/Input'

const Input = styled(DefaultInput)`
  width: 100%;
  ${p =>
    p.hasBeenUpdated
      ? `
    input {
      border: #5284FF solid 1px;
    }
    
  `
      : ``}
`

const RecordInput = ({
  onChange,
  value,
  isValid,
  isInvalid,
  dataType,
  contentType,
  placeholder,
  hasBeenUpdated,
  testId
}) => {
  return (
    <Input
      hasBeenUpdated={hasBeenUpdated}
      warning={dataType === 'content' && contentType === 'oldcontent'}
      valid={isValid && hasBeenUpdated}
      value={value == emptyAddress ? '' : value}
      invalid={isInvalid}
      placeholder={placeholder}
      onChange={onChange}
      testId={testId}
    />
  )
}

export default RecordInput
