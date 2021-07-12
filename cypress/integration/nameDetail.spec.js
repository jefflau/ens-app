const ROOT = Cypress.env('ROOT')
const NAME_ROOT = Cypress.env('NAME_ROOT')

const DISABLED_COLOUR = 'rgb(223, 223, 223)'

function waitUntilInputResolves(buttonTextOrOptions) {
  return cy.waitUntilInputResolves(buttonTextOrOptions)
}

function waitUntilTestIdDoesNotExist(testId) {
  return cy.waitUntilTestIdDoesNotExist(testId)
}

function waitUntilTextDoesNotExist(text) {
  return cy.waitUntilTextDoesNotExist(text)
}

function confirmRecordUpdate() {
  cy.getByTestId('action').click({ force: true })
  cy.wait(10000)
  cy.getByTestId('send-transaction').click({
    force: true
  })
  cy.wait(1000)
}

function refreshAndCheckText(url, textOrArrayOfText) {
  cy.visit(url)
  cy.wait(10000)
  if (typeof textOrArrayOfText === 'string') {
    cy.queryByText(textOrArrayOfText, { timeout: 20000 }).should('exist')
  } else {
    textOrArrayOfText.forEach(text =>
      cy.queryByText(text, { timeout: 20000 }).should('exist')
    )
  }
}

describe('Name detail view', () => {
  it('can see list of top level domains from [root]', () => {
    cy.visit(`${NAME_ROOT}/[root]/subdomains`)
    cy.queryByTestId('eth', { timeout: 10000 }).should('exist')
    cy.queryByTestId('reverse', { timeout: 10000 }).should('exist')
    cy.url().should('eq', `${NAME_ROOT}/[root]/subdomains`)
  })
  it('cannot transfer ownership to a non-ethereum address', () => {
    cy.visit(`${NAME_ROOT}/awesome.eth`)
    cy.getByText('Transfer')
      .scrollIntoView()
      .click({ force: true })

    cy.getByTestId('name-details').within(container => {
      cy.getByPlaceholderText('address', {
        container,
        exact: false,
        timeout: 10000
      }).type('nope', {
        force: true
      })
    })

    cy.queryByText('Transfer').should(
      'have.css',
      'background-color',
      'rgb(223, 223, 223)'
    )
  })

  it('can transfer ownership', () => {
    cy.visit(`${NAME_ROOT}/awesome.eth`)
    cy.getByText('Transfer').click({ force: true })

    cy.getByTestId('name-details').within(container => {
      cy.getByPlaceholderText('address', {
        container,
        exact: false,
        timeout: 10000
      }).type('0x0000000000000000000000000000000000000001', {
        force: true,
        delay: 0
      })
    })
    waitUntilInputResolves('Transfer').then(() => {
      cy.wait(1000)
      cy.getByText('Transfer').click({ force: true })
      cy.getByText('Confirm').click({ force: true })

      cy.getByText('0x0000000000000000000000000000000000000001', {
        timeout: 11000
      }).should('exist')
    })
  })

  it('can change the resolver to the public resolver', () => {
    cy.visit(`${NAME_ROOT}/superawesome.eth`)
    waitUntilInputResolves({ type: 'testId', value: 'edit-resolver' }).then(
      () => {
        cy.getByTestId('edit-resolver').click({ force: true })

        cy.getByText('Use Public Resolver', {
          exact: true,
          timeout: 10000
        }).click({
          force: true
        })

        waitUntilInputResolves('Save').then(() => {
          cy.getByTestId('name-details').within(container => {
            cy.getByPlaceholderText('address', {
              container,
              timeout: 10000,
              exact: false
            }).then($address => {
              cy.getByText('Save', { timeout: 5000 }).click({ force: true })
            })
          })
        })
        waitUntilInputResolves('Confirm').then(() => {
          cy.getByText('Confirm', { timeout: 5000 }).click({ force: true })
        })
        cy.getByTestId('name-details').within(container => {
          cy.getByPlaceholderText('address', {
            container,
            timeout: 10000,
            exact: false
          }).then($address => {
            cy.getByText($address.val(), { timeout: 10000 }).should('exist')
          })
        })
      }
    )
  })

  it('cannot change the resolver to a non contract address', () => {
    cy.visit(`${NAME_ROOT}/superawesome.eth`)
    waitUntilInputResolves({ type: 'testId', value: 'edit-resolver' }).then(
      () => {
        cy.getByTestId('edit-resolver').click({ force: true })
        cy.getByPlaceholderText(
          'Use the Public Resolver or enter the address of your custom resolver contract',
          {
            timeout: 10000,
            exact: false
          }
        ).type('0x0000000000000000000000000000000000000002', {
          force: true,
          timeout: 10000
        })
        cy.queryByTestId('resolver-address-warning').should('exist')
        cy.queryByTestId('action')
          .should('have.text', 'Save')
          .should('have.css', 'background-color', DISABLED_COLOUR)
      }
    )
  })

  it(`prevents user from adding a record that isn't an address`, () => {
    cy.visit(`${NAME_ROOT}/notsoawesome.eth`)

    cy.getByTestId('name-details').within(container => {
      cy.getByText('Add/Edit Record').click({ force: true, exact: false })
      cy.getByText('Add record', { timeout: 10000 }).click({
        force: true
      })
      cy.getByText('Addresses', { timeout: 10000 }).click({
        force: true
      })

      cy.getByText('Coin', { timeout: 10000 }).click({
        force: true
      })
      cy.getByText('ETH', { timeout: 10000 }).click({
        force: true
      })
      cy.getByPlaceholderText('Enter a ETH Address', {
        timeout: 10000,
        exact: false
      }).type('blah', { force: true, timeout: 10000 })

      cy.getByPlaceholderText('Enter a ETH Address', {
        exact: false
      }).should(elem => {
        expect(elem.val()).to.equal('blah')
      })
      cy.queryByTestId('save-record', { exact: false }).should('be.disabled')

      //force click like a real user
      cy.getByTestId('save-record', { exact: false }).click({ force: true })

      cy.getByPlaceholderText('Enter a ETH Address', {
        exact: false
      }).should(elem => {
        expect(elem.val()).to.equal('blah')
      })

      // Form was not closed and nothing happened
      // This query seems flakey
      // cy.queryByValue('blah').should('exist')
    })
  })

  it('can add record', () => {
    const address = '0x0000000000000000000000000000000000000003'
    const content = 'ipfs://QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB'
    const contentv1 =
      'ipfs://bafybeico3uuyj3vphxpvbowchdwjlrlrh62awxscrnii7w7flu5z6fk77y'
    const otherAddress = 'MQMcJhpWHYVeQArcZR3sBgyPZxxRtnH441'
    const text = 'Hello'
    const url = `${NAME_ROOT}/notsoawesome.eth`
    cy.visit(url)

    cy.getByTestId('name-details').within(container => {
      cy.getByText('Add/Edit Record').click({ force: true, exact: false })
      cy.getByText('Add record', { timeout: 10000 }).click({
        force: true
      })
      // Address
      cy.getByText('Addresses')
        .click({ force: true })
        .getByText('Coin', { exact: false })
        .click({ force: true })
        .getByText('ETH', { timeout: 10000 })
        .click({
          force: true
        })
        .getByPlaceholderText('Enter a ETH Address', {
          timeout: 10000,
          exact: false
        })
        .type(address, {
          force: true,
          timeout: 10000
        })
        .waitUntilInputResolves('Save')
        .then(() => {
          cy.getByText('Save').click({ force: true })
        })
      // Content
      cy.getByText('Add record')
        .click({ force: true })
        .getByText('Content', { timeout: 10000 })
        .click({ force: true })
        .getByPlaceholderText('Enter a content hash', {
          exact: false
        })
        .type(content, { force: true, delay: 0 })
        .waitUntilInputResolves('Save')
        .then(() => {
          cy.getByText('Save').click({ force: true })
        })

      // Other Address
      cy.getByText('Add record')
        .click({ force: true })
        .getByText('Addresses', { timeout: 10000 })
        .click({ force: true })
        .getByText('Coin', { exact: false })
        .click({ force: true })
        .getByText('LTC', { exact: false })
        .click({ force: true })
        .getByPlaceholderText('Enter a LTC address', {
          exact: false,
          timeout: 10000
        })
        .type(otherAddress, { force: true, delay: 0 })
        .waitUntilInputResolves('Save')
        .then(() => {
          cy.getByText('Save').click({ force: true, timeout: 5000 })
        })
      // Text
      cy.getByText('Add record')
        .click({ force: true })
        .getByText('Text', { timeout: 10000 })
        .click({ force: true })
        .getByText('Key', { exact: false })
        .click({ force: true })
        .getByText('Notice', { exact: false })
        .click({ force: true })
        .getByPlaceholderText('Enter notice', { exact: false, timeout: 10000 })
        .type(text, { force: true, delay: 0 })
        .waitUntilInputResolves('Save')
        .then(() => {
          cy.getByText('Save').click({ force: true })
        })
      // Other Text
      cy.getByText('Add record')
        .click({ force: true })
        .getByText('Text', { timeout: 10000 })
        .click({ force: true })
        .getByText('Key', { exact: false })
        .click({ force: true })
        .get('input#react-select-6-input', { timeout: 10000 })
        .type('FOOOOOOOO{enter}')
        .getByPlaceholderText('FOOOOOOOO', { exact: false })
        .type('Bar', { force: true, delay: 0 })
      waitUntilInputResolves('Save').then(() => {
        cy.getByText('Save').click({ force: true })
      })
    })
    confirmRecordUpdate()

    refreshAndCheckText(url, [
      address,
      contentv1,
      otherAddress,
      text,
      'FOOOOOOOO',
      'Bar'
    ])
  })

  it('can change the record', () => {
    const url = `${NAME_ROOT}/abittooawesome.eth`
    cy.visit(url)

    const ADDRESS = '0x0000000000000000000000000000000000000007'
    const CONTENT =
      'bzz://d1de9994b4d039f6548d191eb26786769f580809256b4685ef316805265ea162'
    const TEXT = 'world'
    const OTHER_TEXT = 'vitalik'
    const OTHER_ADDRESS = 'MQMcJhpWHYVeQArcZR3sBgyPZxxRtnH441'

    cy.getByTestId('name-details', { timeout: 10000 }).within(container => {
      cy.getByText('Add/Edit Record').click({ force: true })
      cy.wait(2000)
      // Address
      cy.getByTestId('ETH-record-input')
        .clear({ force: true })
        .type(ADDRESS, { force: true })
        // Content
        .getByTestId('content-record-input')
        .clear({ force: true })
        .type(CONTENT, { force: true })
        // // Text
        .getByTestId('notice-record-input')
        .clear({ force: true })
        .type(TEXT, { force: true })
        // Other Text
        .getByTestId('com.twitter-record-input')
        .clear({ force: true })
        .type(OTHER_TEXT, { force: true })
        // Other Address
        .getByTestId('LTC-record-input', { timeout: 10000 })
        .clear({ force: true })
        .type(OTHER_ADDRESS, { force: true })
    })

    confirmRecordUpdate()
    refreshAndCheckText(url, [
      ADDRESS,
      CONTENT,
      TEXT,
      OTHER_TEXT,
      OTHER_ADDRESS
    ])
  })

  it('cannot change deprecated ipns contenthash', () => {
    const url = `${NAME_ROOT}/abittooawesome2.eth`
    cy.visit(url)
    const DEPRECATED_CONTENT_HASH = 'ipns://app.uniswap.org'
    cy.queryByText(DEPRECATED_CONTENT_HASH, { timeout: 10000 }).should('exist')

    cy.getByTestId('name-details', { timeout: 10000 }).within(container => {
      cy.getByText('Add/Edit Record').click({ force: true })
      cy.wait(2000)
      cy.queryByTestId('content-record-input-invalid')
    })
  })

  it('can delete records', () => {
    cy.visit(`${NAME_ROOT}/notsoawesome.eth`)
    cy.getByTestId('name-details').within(container => {
      cy.getByText('Add/Edit Record').click({ force: true })

      cy.getByTestId('ETH-record-delete', {
        exact: false,
        timeout: 10000
      }).click({
        force: true
      })

      cy.getByTestId('delete-content', { exact: false, timeout: 10000 }).click({
        force: true
      })

      cy.getByTestId('LTC-record-delete', {
        exact: false,
        timeout: 10000
      }).click({
        force: true
      })

      cy.getByTestId('notice-record-delete', {
        exact: false,
        timeout: 10000
      }).click({
        force: true
      })
    })

    //confirmRecordUpdate()
  })

  it('can navigate to a subdomain', () => {
    cy.visit(`${NAME_ROOT}/subdomaindummy.eth/subdomains`, { timeout: 10000 })
    cy.getByText('original.subdomaindummy.eth', { timeout: 15000 }).click({
      force: true
    })
  })

  it('can add a subdomain', () => {
    const LABEL = 'sub1' // using the same subdomain label which is used at sub1.testing.eth
    cy.visit(`${NAME_ROOT}/subdomaindummy.eth/subdomains`, { timeout: 10000 })

    cy.getByTestId('subdomains').within(() => {
      cy.wait(1000)
      cy.getByText('add', { exact: false, timeout: 10000 }).click({
        force: true
      })
      cy.getByPlaceholderText('Type in a label', {
        exact: false,
        timeout: 10000
      }).type(LABEL, {
        force: true
      })
      cy.getByText('save', { exact: false }).click({ force: true })
    })
    cy.wait(1000)
    cy.visit(`${NAME_ROOT}/subdomaindummy.eth/subdomains`)
      .getByText('subdomains', { exact: false, timeout: 10000 })
      .click({ force: true })

    cy.queryByText(`${LABEL}.subdomaindummy.eth`, { timeout: 10000 }).should(
      'exist'
    )
  })
})
