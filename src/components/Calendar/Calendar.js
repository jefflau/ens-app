import React, { forwardRef } from 'react'
import AddToCalendarHOC from 'react-add-to-calendar-hoc'
import Dropdown from './Dropdown'
import DefaultButton from '../Forms/Button'
import styled from '@emotion/styled/macro'
import { css } from 'emotion'
import { useTranslation } from 'react-i18next'
import calendar from '../../assets/calendar.svg'

const AddToCalendarContainer = styled('div')`
  ${p =>
    p.invalid &&
    `
    opacity: 0.3;
    pointer-events: none ;  
  `};
`

const Button = styled(DefaultButton)`
  border: none;
  display: flex;
  align-items: center;
  padding: 0;

  &:hover {
    border: none;
  }
`

const CalendarButton = forwardRef((props, ref) => (
  <Button type="hollow-primary" ref={ref} {...props}>
    <img src={calendar} alt="calendar icon" />
    &nbsp;
    {props.children}
  </Button>
))

function CalendarInvite({ noMargin, dropDownLinks = [], event, invalid }) {
  const { t } = useTranslation()

  const styles = css`
    position: relative;
    margin-right: 10px;
    ${noMargin
      ? `
      margin: 0;
    `
      : ''}
  `

  const AddToCalendar = AddToCalendarHOC(CalendarButton, Dropdown)
  return (
    <AddToCalendarContainer invalid={invalid}>
      <AddToCalendar
        event={event}
        className={styles}
        buttonText={t('expiryNotification.reminder')}
        items={['Google', 'iCal']}
        dropdownProps={{
          prependChildren: dropDownLinks
        }}
      />
    </AddToCalendarContainer>
  )
}

export default CalendarInvite

export { CalendarButton }
