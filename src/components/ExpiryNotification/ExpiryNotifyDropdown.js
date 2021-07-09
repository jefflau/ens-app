import React, { createRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from '@emotion/styled'
import { CalendarButton } from '../Calendar/Calendar'
import Dropdown from '../Calendar/Dropdown'
import EmailNotifyLink from './EmailNotifyLink'
import Modal from '../Modal/Modal'
import ExpiryNotificationModal from './ExpiryNotificationModal'
import { useOnClickOutside } from 'components/hooks'

const ExpiryNotifyDropdownContainer = styled('div')`
  position: relative;
`

export default function ExpiryNotifyDropdown({ address }) {
  const dropdownRef = createRef()
  const togglerRef = createRef()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const { t } = useTranslation()

  useOnClickOutside([dropdownRef, togglerRef], () => setShowDropdown(false))

  const handleDropdownClick = () => {
    setShowDropdown(value => !value)
  }

  const handleEmailNotifyClick = () => {
    setShowModal(true)
    setShowDropdown(false)
  }

  const handleCloseModal = () => {
    setShowModal(false)
  }

  return (
    <ExpiryNotifyDropdownContainer>
      <CalendarButton ref={togglerRef} onClick={handleDropdownClick}>
        {t('expiryNotification.reminder')}
      </CalendarButton>
      {showDropdown && (
        <Dropdown ref={dropdownRef}>
          <EmailNotifyLink
            onClick={handleEmailNotifyClick}
            key="email"
            address={address}
          >
            {t('c.email')}
          </EmailNotifyLink>
        </Dropdown>
      )}
      {showModal && (
        <Modal closeModal={handleCloseModal}>
          <ExpiryNotificationModal
            {...{ address, onCancel: handleCloseModal }}
          />
        </Modal>
      )}
    </ExpiryNotifyDropdownContainer>
  )
}
